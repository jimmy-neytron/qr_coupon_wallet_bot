import { describe, expect, it } from 'vitest';
import { markExpiringCouponsModalShown, shouldShowExpiringCouponsModal } from '../expiryReminder';

describe('expiry reminder modal rules', () => {
  it('shows modal once when selected collection has expiring coupons', () => {
    const shownSpaceIds = new Set<string>();

    expect(shouldShowExpiringCouponsModal({ selectedSpaceId: 'space-1', isLoading: false, expiringCount: 2, shownSpaceIds })).toBe(true);

    const nextShown = markExpiringCouponsModalShown(shownSpaceIds, 'space-1');

    expect(shouldShowExpiringCouponsModal({ selectedSpaceId: 'space-1', isLoading: false, expiringCount: 2, shownSpaceIds: nextShown })).toBe(false);
    expect(shownSpaceIds.has('space-1')).toBe(false);
  });

  it('does not show modal while loading or without selected collection or coupons', () => {
    expect(shouldShowExpiringCouponsModal({ selectedSpaceId: 'space-1', isLoading: true, expiringCount: 2, shownSpaceIds: new Set() })).toBe(false);
    expect(shouldShowExpiringCouponsModal({ selectedSpaceId: null, isLoading: false, expiringCount: 2, shownSpaceIds: new Set() })).toBe(false);
    expect(shouldShowExpiringCouponsModal({ selectedSpaceId: 'space-1', isLoading: false, expiringCount: 0, shownSpaceIds: new Set() })).toBe(false);
  });
});
