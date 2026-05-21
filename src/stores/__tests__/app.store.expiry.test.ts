import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Coupon } from '../../types/domain';
import { useAppStore } from '../app.store';

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
    expires_at: null,
    is_favorite: false,
    is_archived: false,
    created_at: '2026-05-21T10:00:00.000Z',
    updated_at: '2026-05-21T10:00:00.000Z',
    created_by: null,
    ...overrides,
  };
}

describe('app.store expiry getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns active coupons that expire in less than a week', () => {
    const store = useAppStore();

    store.coupons = [
      coupon({ id: 'today', title: 'Сегодня', expires_at: '2026-05-21' }),
      coupon({ id: 'six-days', title: 'Через шесть дней', expires_at: '2026-05-27' }),
      coupon({ id: 'week', title: 'Через неделю', expires_at: '2026-05-28' }),
      coupon({ id: 'expired', title: 'Уже истёк', expires_at: '2026-05-20' }),
      coupon({ id: 'archived', title: 'В архиве', expires_at: '2026-05-21', is_archived: true }),
    ];

    expect(store.expiringSoonCoupons.map((item) => item.coupon.id)).toEqual(['today', 'six-days']);
    expect(store.expiringSoonCoupons.map((item) => item.daysLeft)).toEqual([0, 6]);
  });
});
