import { describe, expect, it } from 'vitest';
import type { Coupon } from '../../types/domain';
import {
  EXPIRING_SOON_DAYS,
  getDaysUntilExpiry,
  getExpiringSoonCoupons,
  getExpiryLabel,
  isCouponExpiringSoon,
  parseDateOnly,
  startOfLocalDay,
} from '../expiry';

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

describe('expiry utils', () => {
  const now = new Date(2026, 4, 21, 12, 30);

  it('parses date-only strings as local dates and rejects invalid values', () => {
    const parsed = parseDateOnly('2026-05-21');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(21);
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly('wrong')).toBeNull();
  });

  it('normalizes dates to local day start', () => {
    const dayStart = startOfLocalDay(new Date(2026, 4, 21, 22, 40));

    expect(dayStart.getHours()).toBe(0);
    expect(dayStart.getMinutes()).toBe(0);
  });

  it('calculates calendar days until expiry without UTC shifts', () => {
    expect(getDaysUntilExpiry('2026-05-21', now)).toBe(0);
    expect(getDaysUntilExpiry('2026-05-22', now)).toBe(1);
    expect(getDaysUntilExpiry('2026-05-27', now)).toBe(6);
    expect(getDaysUntilExpiry('2026-05-28', now)).toBe(7);
    expect(getDaysUntilExpiry('2026-05-20', now)).toBe(-1);
    expect(getDaysUntilExpiry(null, now)).toBeNull();
  });

  it('detects only active coupons that expire in less than a week', () => {
    expect(isCouponExpiringSoon(coupon({ expires_at: '2026-05-21' }), EXPIRING_SOON_DAYS, now)).toBe(true);
    expect(isCouponExpiringSoon(coupon({ expires_at: '2026-05-27' }), EXPIRING_SOON_DAYS, now)).toBe(true);
    expect(isCouponExpiringSoon(coupon({ expires_at: '2026-05-28' }), EXPIRING_SOON_DAYS, now)).toBe(false);
    expect(isCouponExpiringSoon(coupon({ expires_at: '2026-05-20' }), EXPIRING_SOON_DAYS, now)).toBe(false);
    expect(isCouponExpiringSoon(coupon({ expires_at: '2026-05-21', is_archived: true }), EXPIRING_SOON_DAYS, now)).toBe(false);
  });

  it('returns expiring coupons sorted by urgency and title', () => {
    const result = getExpiringSoonCoupons(
      [
        coupon({ id: 'later', title: 'Я', expires_at: '2026-05-28' }),
        coupon({ id: 'b', title: 'Бета', expires_at: '2026-05-22' }),
        coupon({ id: 'a', title: 'Альфа', expires_at: '2026-05-22' }),
        coupon({ id: 'today', title: 'Сегодня', expires_at: '2026-05-21' }),
        coupon({ id: 'archived', title: 'Архив', expires_at: '2026-05-21', is_archived: true }),
      ],
      EXPIRING_SOON_DAYS,
      now,
    );

    expect(result.map((item) => item.coupon.id)).toEqual(['today', 'a', 'b']);
    expect(result.map((item) => item.daysLeft)).toEqual([0, 1, 1]);
  });

  it('formats compact labels for expiring coupons', () => {
    expect(getExpiryLabel(0)).toBe('Сегодня');
    expect(getExpiryLabel(1)).toBe('Завтра');
    expect(getExpiryLabel(6)).toBe('Через 6 дн.');
  });
});
