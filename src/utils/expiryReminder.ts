export type ExpiryReminderState = {
  selectedSpaceId: string | null;
  isLoading: boolean;
  expiringCount: number;
  shownSpaceIds: ReadonlySet<string>;
};

/**
 * Decides whether the app should open the expiration reminder modal.
 * The modal is shown once per collection per application session.
 */
export function shouldShowExpiringCouponsModal(state: ExpiryReminderState): boolean {
  if (state.isLoading) return false;
  if (!state.selectedSpaceId) return false;
  if (state.expiringCount === 0) return false;

  return !state.shownSpaceIds.has(state.selectedSpaceId);
}

/**
 * Returns a new immutable set with the collection marked as already notified.
 */
export function markExpiringCouponsModalShown(shownSpaceIds: ReadonlySet<string>, spaceId: string): Set<string> {
  return new Set([...shownSpaceIds, spaceId]);
}
