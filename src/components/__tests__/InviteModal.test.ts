import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InviteModal from '../InviteModal.vue';
import type { Invite } from '../../types/domain';

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'invite-1',
    space_id: 'space-1',
    code: 'ABCD-1234',
    created_by_user_id: 'user-1',
    used_by_user_id: null,
    used_at: null,
    expires_at: null,
    created_at: '2026-05-21T10:00:00.000Z',
    ...overrides,
  };
}

function mountInviteModal(props: Partial<InstanceType<typeof InviteModal>['$props']> = {}) {
  return mount(InviteModal, {
    props: {
      modelValue: true,
      invite: invite(),
      inviteLink: 'https://t.me/qr_coupon_wallet_bot/coupons?startapp=invite_ABCD-1234',
      ...props,
    },
    global: {
      stubs: {
        BaseModal: {
          props: ['modelValue', 'title', 'subtitle', 'isBusy'],
          emits: ['update:modelValue'],
          template: '<section v-if="modelValue" data-testid="base-modal"><slot /></section>',
        },
        LoadingSpinner: {
          template: '<span data-testid="spinner" />',
        },
      },
    },
  });
}

describe('InviteModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders invite code and invite link', () => {
    const wrapper = mountInviteModal();

    expect(wrapper.text()).toContain('ABCD-1234');
    expect(wrapper.text()).toContain('https://t.me/qr_coupon_wallet_bot/coupons?startapp=invite_ABCD-1234');
    expect(wrapper.text()).toContain('Скопировать ссылку');
  });

  it('copies invite code with icon button', async () => {
    const wrapper = mountInviteModal();
    const copyCodeButton = wrapper.get('button[aria-label="Скопировать код"]');

    await copyCodeButton.trigger('click');
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD-1234');
    expect(wrapper.text()).toContain('Скопировано');
  });

  it('copies invite link with primary button', async () => {
    const wrapper = mountInviteModal();
    const copyLinkButton = wrapper.findAll('button').find((button) => button.text().includes('Скопировать ссылку'));

    expect(copyLinkButton).toBeTruthy();
    await copyLinkButton!.trigger('click');
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://t.me/qr_coupon_wallet_bot/coupons?startapp=invite_ABCD-1234');
    expect(wrapper.text()).toContain('Скопировано');
  });

  it('shows error status when clipboard copy fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('clipboard denied'));
    const wrapper = mountInviteModal();

    await wrapper.get('button[aria-label="Скопировать код"]').trigger('click');
    await Promise.resolve();

    expect(wrapper.text()).toContain('Не удалось');
  });

  it('emits create when invite is not created yet', async () => {
    const wrapper = mountInviteModal({ invite: null });

    expect(wrapper.text()).toContain('Код ещё не создан');
    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('create')).toHaveLength(1);
  });
});
