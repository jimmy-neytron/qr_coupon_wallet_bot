import type { Coupon } from '../types/domain';

export const EXPIRING_SOON_DAYS = 7;

export type ExpiringCouponInfo = {
  coupon: Coupon;
  daysLeft: number;
};

/**
 * Parses a date-only API value as a local calendar date.
 * This avoids off-by-one errors caused by UTC conversion of strings like 2026-05-21.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;

  const [datePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Returns a date shifted to local midnight so date comparisons use calendar days.
 */
export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/**
 * Returns how many full calendar days are left before a coupon expires.
 */
export function getDaysUntilExpiry(expiresAt: string | null | undefined, now = new Date()): number | null {
  const expiryDate = parseDateOnly(expiresAt);
  if (!expiryDate) return null;

  const millisecondsInDay = 24 * 60 * 60 * 1000;
  const today = startOfLocalDay(now).getTime();
  const expiry = startOfLocalDay(expiryDate).getTime();

  return Math.round((expiry - today) / millisecondsInDay);
}

/**
 * Checks whether a coupon should be shown in the expiration reminder modal.
 * Expired and archived coupons are intentionally hidden from this reminder.
 */
export function isCouponExpiringSoon(coupon: Coupon, daysThreshold = EXPIRING_SOON_DAYS, now = new Date()): boolean {
  if (coupon.is_archived) return false;

  const daysLeft = getDaysUntilExpiry(coupon.expires_at, now);
  if (daysLeft === null) return false;

  return daysLeft >= 0 && daysLeft < daysThreshold;
}

/**
 * Returns active coupons with less than a week left before expiration, sorted by urgency.
 */
export function getExpiringSoonCoupons(
  coupons: Coupon[],
  daysThreshold = EXPIRING_SOON_DAYS,
  now = new Date(),
): ExpiringCouponInfo[] {
  return coupons
    .map((coupon) => ({ coupon, daysLeft: getDaysUntilExpiry(coupon.expires_at, now) }))
    .filter((item): item is ExpiringCouponInfo => {
      return item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft < daysThreshold && !item.coupon.is_archived;
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || a.coupon.title.localeCompare(b.coupon.title, 'ru'));
}

/**
 * Converts days left to a short Russian label for UI cards.
 */
export function getExpiryLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'Сегодня';
  if (daysLeft === 1) return 'Завтра';

  return `Через ${daysLeft} дн.`;
}
