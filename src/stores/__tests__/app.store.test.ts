import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser, Space } from '../../types/domain';
import { offlineDb, resetOfflineDatabaseForTests } from '../../services/offlineDb';

const createdAt = '2026-05-21T12:00:00.000Z';

const user: AppUser = {
  id: 'user-1',
  telegram_user_id: 100001,
  username: 'dev_user',
  first_name: 'Dev',
  last_name: 'User',
  photo_url: null,
  created_at: createdAt,
  updated_at: createdAt,
};

const personalSpace: Space = {
  id: 'space-personal',
  owner_user_id: user.id,
  title: 'Мои промокоды',
  type: 'personal',
  role: 'owner',
  created_at: createdAt,
  updated_at: createdAt,
};

async function createStoreWithNetworkFailure() {
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  vi.stubEnv('VITE_DEV_TELEGRAM_USER', JSON.stringify({ id: 100001, first_name: 'Dev', username: 'dev_user' }));
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });

  const { useAppStore } = await import('../app.store');
  const store = useAppStore();

  store.user = user;
  store.spaces = [personalSpace];
  store.selectedSpaceId = personalSpace.id;
  store.groups = [];
  store.coupons = [];
  store.isOnline = true;

  await offlineDb.saveMe(user, [personalSpace]);
  await offlineDb.saveSelectedSpaceId(personalSpace.id);

  return store;
}

beforeEach(async () => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
  await resetOfflineDatabaseForTests();
});

describe('app.store offline fallback', () => {
  it('saves a new coupon locally when network fails during online mode', async () => {
    const store = await createStoreWithNetworkFailure();

    const coupon = await store.createCoupon({
      title: 'Offline coupon',
      qr_text: 'OFFLINE-QR-1',
      type: 'qr',
      group_id: null,
      note: null,
      expires_at: null,
    });

    expect(coupon.id).toContain('local_coupon_');
    expect(store.isOffline).toBe(true);
    expect(store.error).toBeNull();
    expect(store.syncError).toContain('сохранено локально');
    expect(store.pendingSyncCount).toBe(1);

    const snapshot = await offlineDb.loadSnapshot(personalSpace.id);
    expect(snapshot.coupons).toHaveLength(1);
    expect(snapshot.coupons[0].qr_text).toBe('OFFLINE-QR-1');
  });

  it('saves a new group locally when network fails during online mode', async () => {
    const store = await createStoreWithNetworkFailure();

    const group = await store.createGroup('Магнит');

    expect(group.id).toContain('local_group_');
    expect(store.isOffline).toBe(true);
    expect(store.error).toBeNull();
    expect(store.pendingSyncCount).toBe(1);

    const snapshot = await offlineDb.loadSnapshot(personalSpace.id);
    expect(snapshot.groups[0].title).toBe('Магнит');
  });
});
