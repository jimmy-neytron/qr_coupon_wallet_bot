import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Coupon } from '../../types/domain';
import ExpiringCouponsModal from '../ExpiringCouponsModal.vue';

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-1',
    space_id: 'space-1',
    group_id: null,
    created_by_user_id: null,
    title: 'Купон',
    qr_text: 'PROMO',
    note: null,
    type: 'text',
    expires_at: '2026-05-22',
    is_favorite: false,
    is_archived: false,
    created_at: '2026-05-21T10:00:00.000Z',
    updated_at: '2026-05-21T10:00:00.000Z',
    created_by: null,
    ...overrides,
  };
}

const mountOptions = {
  attachTo: document.body,
  global: {
    stubs: {
      Teleport: true,
      Transition: false,
    },
  },
};

describe('ExpiringCouponsModal', () => {
  it('renders expiring coupons with labels', () => {
    const wrapper = mount(ExpiringCouponsModal, {
      ...mountOptions,
      props: {
        modelValue: true,
        coupons: [
          { coupon: coupon({ id: 'today', title: 'Магнит', expires_at: '2026-05-21' }), daysLeft: 0 },
          { coupon: coupon({ id: 'tomorrow', title: 'Аптека', expires_at: '2026-05-22' }), daysLeft: 1 },
        ],
      },
    });

    expect(wrapper.text()).toContain('Скоро закончатся');
    expect(wrapper.text()).toContain('Магнит');
    expect(wrapper.text()).toContain('Аптека');
    expect(wrapper.text()).toContain('Сегодня');
    expect(wrapper.text()).toContain('Завтра');

    wrapper.unmount();
  });

  it('emits open and closes when coupon is selected', async () => {
    const expiringCoupon = coupon({ id: 'coupon-open', title: 'Открыть купон' });
    const wrapper = mount(ExpiringCouponsModal, {
      ...mountOptions,
      props: {
        modelValue: true,
        coupons: [{ coupon: expiringCoupon, daysLeft: 3 }],
      },
    });

    await wrapper.find('.expiry-modal__item').trigger('click');

    expect(wrapper.emitted('open')?.[0]).toEqual([expiringCoupon]);
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);

    wrapper.unmount();
  });
});
