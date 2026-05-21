import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser, Coupon, CouponGroup, CreateCouponPayload, Space, SpaceMember } from '../../types/domain';
import { createLocalId, offlineDb, resetOfflineDatabaseForTests, type SyncOperation } from '../../services/offlineDb';
import { ApiError } from '../../composables/useApi';

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

const sharedSpace: Space = {
  id: 'space-shared',
  owner_user_id: user.id,
  title: 'Наши промокоды',
  type: 'shared',
  role: 'owner',
  created_at: createdAt,
  updated_at: createdAt,
};

const member: SpaceMember = {
  space_id: personalSpace.id,
  user_id: user.id,
  role: 'owner',
  created_at: createdAt,
  user,
};

function group(overrides: Partial<CouponGroup> = {}): CouponGroup {
  return {
    id: 'group-1',
    space_id: personalSpace.id,
    title: 'Магнит',
    coupons_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  };
}

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-1',
    space_id: personalSpace.id,
    group_id: 'group-1',
    created_by_user_id: user.id,
    title: 'Скидка 10%',
    qr_text: 'QR-10',
    type: 'qr',
    note: null,
    expires_at: null,
    is_favorite: false,
    is_archived: false,
    created_at: createdAt,
    updated_at: createdAt,
    created_by: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
    },
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(payload),
  } as Response);
}

function mockFetchByRoute(routes: Record<string, unknown | (() => unknown)>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? 'GET'} ${url.pathname}${url.search}`;
    const value = routes[key] ?? routes[`${init?.method ?? 'GET'} ${url.pathname}`];

    if (value instanceof Error) return Promise.reject(value);
    if (typeof value === 'function') return jsonResponse(value());
    if (value === undefined) return jsonResponse({ message: `Unhandled route ${key}` }, 500);
    return jsonResponse(value);
  });
}

async function importStore() {
  const { useAppStore } = await import('../app.store');
  return useAppStore();
}

async function createSeededStore(options: { online?: boolean; fetchMock?: ReturnType<typeof vi.fn> } = {}) {
  vi.stubGlobal('fetch', options.fetchMock ?? vi.fn());
  const store = await importStore();

  store.user = user;
  store.spaces = [personalSpace];
  store.selectedSpaceId = personalSpace.id;
  store.members = [member];
  store.groups = [group()];
  store.coupons = [coupon()];
  store.isOnline = options.online ?? true;

  await offlineDb.saveMe(user, [personalSpace]);
  await offlineDb.saveSelectedSpaceId(personalSpace.id);
  await offlineDb.saveMembers(personalSpace.id, [member]);
  await offlineDb.saveGroups(personalSpace.id, [group()]);
  await offlineDb.saveCoupons(personalSpace.id, [coupon()]);

  return store;
}

beforeEach(async () => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_API_URL', 'https://api.test');
  vi.stubEnv('VITE_DEV_TELEGRAM_USER', JSON.stringify({ id: 100001, first_name: 'Dev', username: 'dev_user' }));
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
  await resetOfflineDatabaseForTests();
});

describe('app.store offline fallback', () => {
  it('saves a new coupon locally when network fails during online mode', async () => {
    const store = await createSeededStore({ online: true, fetchMock: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });

    const created = await store.createCoupon({
      title: 'Offline coupon',
      qr_text: 'OFFLINE-QR-1',
      type: 'qr',
      group_id: null,
      note: null,
      expires_at: null,
    });

    expect(created.id).toContain('local_coupon_');
    expect(store.isOffline).toBe(true);
    expect(store.error).toBeNull();
    expect(store.syncError).toContain('сохранено локально');
    expect(store.pendingSyncCount).toBe(1);
  });

  it('saves a new group locally when network fails during online mode', async () => {
    const store = await createSeededStore({ online: true, fetchMock: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });

    const created = await store.createGroup('Пятёрочка');

    expect(created.id).toContain('local_group_');
    expect(store.isOffline).toBe(true);
    expect(store.error).toBeNull();
    expect(store.pendingSyncCount).toBe(1);
  });

  it('updates and deletes records locally when offline', async () => {
    const store = await createSeededStore({ online: false });

    const updatedGroup = await store.renameGroup('group-1', 'Новый Магнит');
    const updatedCoupon = await store.updateCoupon('coupon-1', { title: 'Новая скидка', is_favorite: true, group_id: null });

    expect(updatedGroup.title).toBe('Новый Магнит');
    expect(updatedCoupon.is_favorite).toBe(true);
    expect(store.pendingSyncCount).toBe(2);

    await store.deleteCoupon('coupon-1');
    await store.deleteGroup('group-1');

    expect(store.coupons).toHaveLength(0);
    expect(store.groups).toHaveLength(0);
    expect(store.pendingSyncCount).toBe(2);
  });

  it('removes queued create operations when local records are deleted before sync', async () => {
    const store = await createSeededStore({ online: false });

    const localGroup = await store.createGroup('Локальная группа');
    const localCoupon = await store.createCoupon({ title: 'Локальный', qr_text: 'LOCAL', type: 'text', group_id: localGroup.id });

    expect(store.pendingSyncCount).toBe(2);

    await store.deleteCoupon(localCoupon.id);
    await store.deleteGroup(localGroup.id);

    expect(await offlineDb.getPendingCount()).toBe(0);
  });

  it('keeps duplicate coupon validation locally', async () => {
    const store = await createSeededStore({ online: false });

    await expect(store.createCoupon({ title: 'Дубль', qr_text: 'QR-10', type: 'qr', group_id: null })).rejects.toThrow('Такой купон уже есть');
    expect(store.error).toBe('Такой купон уже есть в этой коллекции');
  });
});

describe('app.store online API operations', () => {
  it('initializes from API and caches received data', async () => {
    const remoteGroup = group({ id: 'group-api', title: 'Золотое яблоко' });
    const activeCoupon = coupon({ id: 'coupon-active', group_id: remoteGroup.id, title: 'Активный' });
    const archivedCoupon = coupon({ id: 'coupon-archived', title: 'Архив', is_archived: true });

    const fetchMock = mockFetchByRoute({
      'GET /functions/v1/api/me': { user, spaces: [personalSpace] },
      'GET /functions/v1/api/spaces/space-personal/members': [member],
      'GET /functions/v1/api/spaces/space-personal/groups': [remoteGroup],
      'GET /functions/v1/api/spaces/space-personal/coupons?archived=false': [activeCoupon],
      'GET /functions/v1/api/spaces/space-personal/coupons?archived=true': [archivedCoupon],
    });
    vi.stubGlobal('fetch', fetchMock);

    const store = await importStore();
    await store.init();

    expect(store.user?.id).toBe(user.id);
    expect(store.groups).toEqual([remoteGroup]);
    expect(store.coupons.map((item) => item.id)).toEqual(['coupon-active', 'coupon-archived']);
    expect(store.error).toBeNull();

    const snapshot = await offlineDb.loadSnapshot(personalSpace.id);
    expect(snapshot.coupons).toHaveLength(2);
  });

  it('falls back to cache when init cannot reach API', async () => {
    await offlineDb.saveMe(user, [personalSpace]);
    await offlineDb.saveSelectedSpaceId(personalSpace.id);
    await offlineDb.saveGroups(personalSpace.id, [group()]);
    await offlineDb.saveCoupons(personalSpace.id, [coupon()]);

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const store = await importStore();

    await store.init();

    expect(store.isOffline).toBe(true);
    expect(store.error).toBeNull();
    expect(store.syncError === null || store.syncError.includes('локальная копия')).toBe(true);
    expect(store.coupons).toHaveLength(1);
  });

  it('creates, renames and deletes groups online', async () => {
    const createdGroup = group({ id: 'group-created', title: 'Аптеки' });
    const renamedGroup = group({ id: 'group-1', title: 'Магнит у дома' });
    const fetchMock = mockFetchByRoute({
      'POST /functions/v1/api/spaces/space-personal/groups': createdGroup,
      'PATCH /functions/v1/api/groups/group-1': renamedGroup,
      'DELETE /functions/v1/api/groups/group-1': { ok: true },
    });
    const store = await createSeededStore({ fetchMock });

    await expect(store.createGroup('Аптеки')).resolves.toMatchObject({ id: 'group-created' });
    await expect(store.renameGroup('group-1', 'Магнит у дома')).resolves.toMatchObject({ title: 'Магнит у дома' });
    await store.deleteGroup('group-1');

    expect(store.groups.some((item) => item.id === 'group-1')).toBe(false);
    expect(store.coupons[0].group_id).toBeNull();
  });

  it('creates, updates and deletes coupons online', async () => {
    const createdCoupon = coupon({ id: 'coupon-created', title: 'SALE500', qr_text: 'SALE500', type: 'text' });
    const updatedCoupon = coupon({ id: 'coupon-1', title: 'Избранный', is_favorite: true });
    const fetchMock = mockFetchByRoute({
      'POST /functions/v1/api/spaces/space-personal/coupons': createdCoupon,
      'PATCH /functions/v1/api/coupons/coupon-1': updatedCoupon,
      'DELETE /functions/v1/api/coupons/coupon-1': { ok: true },
    });
    const store = await createSeededStore({ fetchMock });

    await expect(store.createCoupon({ title: 'SALE500', qr_text: 'SALE500', type: 'text' })).resolves.toMatchObject({ id: 'coupon-created' });
    await expect(store.updateCoupon('coupon-1', { is_favorite: true, title: 'Избранный' })).resolves.toMatchObject({ is_favorite: true });
    await store.deleteCoupon('coupon-1');

    expect(store.coupons.some((item) => item.id === 'coupon-1')).toBe(false);
  });

  it('maps duplicate coupon API errors to friendly state', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ message: 'duplicate', details: { existing_coupon: coupon() } }, 409)));
    const store = await createSeededStore();

    await expect(store.createCoupon({ title: 'Дубль', qr_text: 'QR-10', type: 'qr' })).rejects.toBeInstanceOf(ApiError);
    expect(store.error).toBe('Такой купон уже есть в этой коллекции');
  });

  it('creates shared space and accepts invite online', async () => {
    const fetchMock = mockFetchByRoute({
      'POST /functions/v1/api/spaces': sharedSpace,
      'GET /functions/v1/api/spaces': [personalSpace, sharedSpace],
      'GET /functions/v1/api/spaces/space-shared/members': [{ ...member, space_id: sharedSpace.id }],
      'GET /functions/v1/api/spaces/space-shared/groups': [],
      'GET /functions/v1/api/spaces/space-shared/coupons?archived=false': [],
      'GET /functions/v1/api/spaces/space-shared/coupons?archived=true': [],
      'POST /functions/v1/api/invites/accept': { space: sharedSpace },
    });
    const store = await createSeededStore({ fetchMock });

    await expect(store.createSharedSpace('Наши промокоды')).resolves.toMatchObject({ id: sharedSpace.id });
    expect(store.selectedSpaceId).toBe(sharedSpace.id);

    await expect(store.acceptInvite('ABCD-1234')).resolves.toMatchObject({ id: sharedSpace.id });
    expect(store.spaces).toHaveLength(2);
  });

  it('blocks internet-only actions while offline', async () => {
    const store = await createSeededStore({ online: false });

    await expect(store.createSharedSpace('Общая')).rejects.toThrow('доступно только с интернетом');
    await expect(store.createInvite()).rejects.toThrow('доступно только с интернетом');
    await expect(store.acceptInvite('CODE')).rejects.toThrow('доступно только с интернетом');
  });
});

describe('app.store sync queue', () => {
  it('syncs queued create/update/delete operations and replaces local ids', async () => {
    const store = await createSeededStore({ online: true });
    store.groups = [];
    store.coupons = [];
    await offlineDb.saveGroups(personalSpace.id, []);
    await offlineDb.saveCoupons(personalSpace.id, []);

    const localGroupId = createLocalId('group');
    const localCouponId = createLocalId('coupon');
    const localGroup = group({ id: localGroupId, title: 'Локальная' });
    const localCoupon = coupon({ id: localCouponId, group_id: localGroupId, title: 'Локальный', qr_text: 'LOCAL' });
    store.groups = [localGroup];
    store.coupons = [localCoupon, coupon({ id: 'coupon-update' }), coupon({ id: 'coupon-delete' })];
    await offlineDb.upsertGroup(localGroup);
    await offlineDb.upsertCoupon(localCoupon);

    const operations: SyncOperation[] = [
      { id: 'sync-1', entity: 'group', action: 'create', space_id: personalSpace.id, record_id: localGroupId, payload: { title: 'Локальная' }, created_at: '1', updated_at: '1' },
      { id: 'sync-2', entity: 'coupon', action: 'create', space_id: personalSpace.id, record_id: localCouponId, payload: { title: 'Локальный', qr_text: 'LOCAL', type: 'qr', group_id: localGroupId }, created_at: '2', updated_at: '2' },
      { id: 'sync-3', entity: 'coupon', action: 'update', space_id: personalSpace.id, record_id: 'coupon-update', payload: { title: 'Обновлённый' }, created_at: '3', updated_at: '3' },
      { id: 'sync-4', entity: 'coupon', action: 'delete', space_id: personalSpace.id, record_id: 'coupon-delete', created_at: '4', updated_at: '4' },
    ];
    for (const operation of operations) await offlineDb.addQueueOperation(operation);

    const remoteGroup = group({ id: 'group-remote', title: 'Локальная' });
    const remoteCoupon = coupon({ id: 'coupon-remote', group_id: 'group-remote', title: 'Локальный', qr_text: 'LOCAL' });
    const updatedCoupon = coupon({ id: 'coupon-update', title: 'Обновлённый' });
    const fetchMock = mockFetchByRoute({
      'POST /functions/v1/api/spaces/space-personal/groups': remoteGroup,
      'POST /functions/v1/api/spaces/space-personal/coupons': remoteCoupon,
      'PATCH /functions/v1/api/coupons/coupon-update': updatedCoupon,
      'DELETE /functions/v1/api/coupons/coupon-delete': { ok: true },
    });
    vi.stubGlobal('fetch', fetchMock);

    await store.syncPendingChanges();

    expect(await offlineDb.getPendingCount()).toBe(0);
    expect(store.groups[0].id).toBe('group-remote');
    expect(store.coupons.some((item) => item.id === 'coupon-remote')).toBe(true);
    expect(store.syncError).toBeNull();
  });

  it('handles duplicate remote records during sync', async () => {
    const store = await createSeededStore({ online: true });
    const localCouponId = createLocalId('coupon');
    const operation: SyncOperation = {
      id: 'sync-duplicate',
      entity: 'coupon',
      action: 'create',
      space_id: personalSpace.id,
      record_id: localCouponId,
      payload: { title: 'Дубль', qr_text: 'QR-10', type: 'qr' },
      created_at: createdAt,
      updated_at: createdAt,
    };
    await offlineDb.addQueueOperation(operation);
    store.coupons = [coupon({ id: localCouponId, title: 'Дубль', qr_text: 'QR-10' })];

    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ message: 'duplicate', details: { existing_coupon: coupon({ id: 'coupon-existing' }) } }, 409)));

    await store.syncPendingChanges();

    expect(await offlineDb.getPendingCount()).toBe(0);
    expect(store.coupons[0].id).toBe('coupon-existing');
  });
});

describe('app.store fetch and collection helpers', () => {
  it('fetches spaces and switches selected space if current one disappeared', async () => {
    const fetchMock = mockFetchByRoute({
      'GET /functions/v1/api/spaces': [sharedSpace],
    });
    const store = await createSeededStore({ fetchMock });

    await store.fetchSpaces();

    expect(store.spaces).toEqual([sharedSpace]);
    expect(store.selectedSpaceId).toBe(sharedSpace.id);
  });

  it('loads spaces, members, groups and coupons from cache while offline', async () => {
    const store = await createSeededStore({ online: false });
    store.spaces = [];
    store.members = [];
    store.groups = [];
    store.coupons = [];

    await store.fetchSpaces();
    await store.fetchMembers();
    await store.fetchGroups();
    await store.fetchCoupons();

    expect(store.spaces).toHaveLength(1);
    expect(store.members).toHaveLength(1);
    expect(store.groups).toHaveLength(1);
    expect(store.coupons).toHaveLength(1);
  });

  it('falls back to cached records when fetch endpoints lose network', async () => {
    const store = await createSeededStore({ online: true, fetchMock: vi.fn(() => Promise.reject(new TypeError('network down'))) });
    store.members = [];
    store.groups = [];
    store.coupons = [];

    await store.fetchMembers();
    await store.fetchGroups();
    await store.fetchCoupons();

    expect(store.isOffline).toBe(true);
    expect(store.members).toHaveLength(1);
    expect(store.groups).toHaveLength(1);
    expect(store.coupons).toHaveLength(1);
    expect(store.syncError).toContain('локальная копия');
  });

  it('selects a collection from cache when offline', async () => {
    await offlineDb.saveMe(user, [personalSpace, sharedSpace]);
    await offlineDb.saveSelectedSpaceId(sharedSpace.id);
    await offlineDb.saveGroups(sharedSpace.id, [group({ id: 'shared-group', space_id: sharedSpace.id })]);
    const store = await createSeededStore({ online: false });

    await store.selectSpace(sharedSpace.id);

    expect(store.selectedSpaceId).toBe(sharedSpace.id);
    expect(store.groups[0].id).toBe('shared-group');
  });

  it('renames and deletes collections online', async () => {
    const renamed = { ...personalSpace, title: 'Новая коллекция' };
    const fetchMock = mockFetchByRoute({
      'PATCH /functions/v1/api/spaces/space-personal': renamed,
      'DELETE /functions/v1/api/spaces/space-personal': { ok: true },
      'GET /functions/v1/api/spaces': [sharedSpace],
    });
    const store = await createSeededStore({ fetchMock });
    store.spaces = [personalSpace, sharedSpace];

    await expect(store.renameSpace(personalSpace.id, 'Новая коллекция')).resolves.toMatchObject({ title: 'Новая коллекция' });
    await store.deleteSpace(personalSpace.id);

    expect(store.spaces).toEqual([sharedSpace]);
    expect(store.selectedSpaceId).toBe(sharedSpace.id);
  });

  it('creates invites online', async () => {
    const invite = { id: 'invite-1', space_id: personalSpace.id, code: 'ABCD-1234', created_by_user_id: user.id, used_by_user_id: null, used_at: null, expires_at: null, created_at: createdAt };
    const store = await createSeededStore({ fetchMock: mockFetchByRoute({ 'POST /functions/v1/api/spaces/space-personal/invites': invite }) });

    await expect(store.createInvite()).resolves.toEqual(invite);
  });

  it('refreshes current space and stores sync time', async () => {
    const fetchMock = mockFetchByRoute({
      'GET /functions/v1/api/spaces/space-personal/members': [member],
      'GET /functions/v1/api/spaces/space-personal/groups': [group({ title: 'Обновлено' })],
      'GET /functions/v1/api/spaces/space-personal/coupons?archived=false': [coupon({ title: 'Активный' })],
      'GET /functions/v1/api/spaces/space-personal/coupons?archived=true': [],
    });
    const store = await createSeededStore({ fetchMock });

    await store.refreshCurrentSpace();

    expect(store.groups[0].title).toBe('Обновлено');
    expect(store.lastSyncedAt).toBeTruthy();
  });

  it('throws critical init error when offline without cache', async () => {
    const store = await importStore();
    store.isOnline = false;

    await expect(store.init()).rejects.toThrow('Нет интернета');
    expect(store.isLoading).toBe(false);
  });
});

describe('app.store sync queue edge cases', () => {
  it('syncs queued group update and delete operations', async () => {
    const store = await createSeededStore({ online: true });
    await offlineDb.addQueueOperation({ id: 'sync-group-update', entity: 'group', action: 'update', space_id: personalSpace.id, record_id: 'group-1', payload: { title: 'Синхронизировано' }, created_at: '1', updated_at: '1' });
    await offlineDb.addQueueOperation({ id: 'sync-group-delete', entity: 'group', action: 'delete', space_id: personalSpace.id, record_id: 'group-delete', created_at: '2', updated_at: '2' });

    const fetchMock = mockFetchByRoute({
      'PATCH /functions/v1/api/groups/group-1': group({ title: 'Синхронизировано' }),
      'DELETE /functions/v1/api/groups/group-delete': { ok: true },
    });
    vi.stubGlobal('fetch', fetchMock);

    await store.syncPendingChanges();

    expect(store.groups[0].title).toBe('Синхронизировано');
    expect(await offlineDb.getPendingCount()).toBe(0);
  });

  it('resolves duplicate group creation during sync by matching remote title', async () => {
    const store = await createSeededStore({ online: true });
    const localGroupId = createLocalId('group');
    store.groups = [group({ id: localGroupId, title: 'Магнит' })];
    await offlineDb.upsertGroup(store.groups[0]);
    await offlineDb.addQueueOperation({ id: 'sync-group-dup', entity: 'group', action: 'create', space_id: personalSpace.id, record_id: localGroupId, payload: { title: 'Магнит' }, created_at: '1', updated_at: '1' });

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === 'POST') return jsonResponse({ message: 'duplicate' }, 409);
      if (url.pathname.endsWith('/groups')) return jsonResponse([group({ id: 'group-existing', title: 'Магнит' })]);
      return jsonResponse({ message: 'Unhandled' }, 500);
    }));

    await store.syncPendingChanges();

    expect(store.groups[0].id).toBe('group-existing');
    expect(await offlineDb.getPendingCount()).toBe(0);
  });

  it('stores sync errors and switches offline on network failure', async () => {
    const store = await createSeededStore({ online: true });
    await offlineDb.addQueueOperation({ id: 'sync-fail', entity: 'coupon', action: 'delete', space_id: personalSpace.id, record_id: 'coupon-1', created_at: '1', updated_at: '1' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    await expect(store.syncPendingChanges()).rejects.toThrow('Failed to fetch');

    expect(store.isOffline).toBe(true);
    expect(store.syncError).toContain('Failed to fetch');
    expect(store.pendingSyncCount).toBe(1);
  });
});

describe('app.store uncovered branches and guards', () => {
  it('exposes derived getters', async () => {
    const store = await createSeededStore({ online: false });
    store.coupons = [coupon(), coupon({ id: 'coupon-archived', is_archived: true, is_favorite: true })];
    store.pendingSyncCount = 1;

    expect(store.selectedSpace?.id).toBe(personalSpace.id);
    expect(store.currentUserRole).toBe('owner');
    expect(store.isOwner).toBe(true);
    expect(store.activeCoupons).toHaveLength(1);
    expect(store.archivedCoupons).toHaveLength(1);
    expect(store.hasPendingSync).toBe(true);
  });

  it('uses offline cache immediately when the browser starts offline', async () => {
    await offlineDb.saveMe(user, [personalSpace]);
    await offlineDb.saveSelectedSpaceId(personalSpace.id);
    await offlineDb.saveCoupons(personalSpace.id, [coupon()]);
    const store = await importStore();
    store.isOnline = false;

    await store.init();

    expect(store.syncError).toContain('Офлайн-режим');
    expect(store.coupons).toHaveLength(1);
  });

  it('sets critical error when init fails without network fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ message: 'Server error' }, 500)));
    const store = await importStore();

    await expect(store.init()).rejects.toThrow('Server error');
    expect(store.error).toBe('Server error');
  });

  it('maps API auth fallback messages when cached data exists', async () => {
    await offlineDb.saveMe(user, [personalSpace]);
    await offlineDb.saveSelectedSpaceId(personalSpace.id);
    await offlineDb.saveCoupons(personalSpace.id, [coupon()]);
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ message: 'Unauthorized' }, 401)));
    const store = await importStore();

    await store.init();

    expect(store.syncError).toContain('Telegram-сессию');
  });

  it('handles collection selection fallback and non-network errors', async () => {
    const fallbackStore = await createSeededStore({ online: true, fetchMock: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });
    await fallbackStore.selectSpace(personalSpace.id);
    expect(fallbackStore.syncError).toContain('локальная копия');

    const failingStore = await createSeededStore({ online: true, fetchMock: vi.fn(() => jsonResponse({ message: 'Forbidden' }, 403)) });
    await expect(failingStore.selectSpace(personalSpace.id)).rejects.toThrow('Forbidden');
    expect(failingStore.error).toBe('Forbidden');
  });

  it('throws non-network fetch errors and returns early without selected space', async () => {
    const store = await createSeededStore({ online: true, fetchMock: vi.fn(() => jsonResponse({ message: 'Boom' }, 500)) });

    await expect(store.fetchSpaces()).rejects.toThrow('Boom');
    await expect(store.fetchMembers()).rejects.toThrow('Boom');
    await expect(store.fetchGroups()).rejects.toThrow('Boom');
    await expect(store.fetchCoupons()).rejects.toThrow('Boom');

    store.selectedSpaceId = null;
    await expect(store.fetchMembers()).resolves.toBeUndefined();
    await expect(store.fetchGroups()).resolves.toBeUndefined();
    await expect(store.fetchCoupons()).resolves.toBeUndefined();
    await expect(store.refreshCurrentSpace()).resolves.toBeUndefined();
  });

  it('falls back during refresh when network disappears', async () => {
    const store = await createSeededStore({ online: true, fetchMock: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });

    await store.refreshCurrentSpace();

    expect(store.isOffline).toBe(true);
    expect(store.syncError === null || store.syncError.includes('локальная копия')).toBe(true);
  });

  it('covers selected-space clearing and missing selection guards', async () => {
    const store = await createSeededStore({ online: false });
    store.selectedSpaceId = null;

    await expect(store.createGroup('Без коллекции')).rejects.toThrow('Коллекция не выбрана');
    await expect(store.createCoupon({ title: 'Без коллекции', qr_text: 'NO-SPACE', type: 'text' })).rejects.toThrow('Коллекция не выбрана');
    await expect(store.createInvite()).rejects.toThrow('доступно только с интернетом');
  });

  it('throws missing record errors for local updates', async () => {
    const store = await createSeededStore({ online: false });

    await expect(store.renameGroup('missing', 'Нет')).rejects.toThrow('Группа не найдена');
    await expect(store.updateCoupon('missing', { title: 'Нет' })).rejects.toThrow('Купон не найден');
  });

  it('sets errors for non-fallback group and coupon mutations', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ message: 'Validation failed' }, 422));
    const store = await createSeededStore({ online: true, fetchMock });

    await expect(store.createGroup('Bad')).rejects.toThrow('Validation failed');
    await expect(store.renameGroup('group-1', 'Bad')).rejects.toThrow('Validation failed');
    await expect(store.deleteGroup('group-1')).rejects.toThrow('Validation failed');
    await expect(store.createCoupon({ title: 'Bad', qr_text: 'BAD', type: 'text' })).rejects.toThrow('Validation failed');
    await expect(store.updateCoupon('coupon-1', { title: 'Bad' })).rejects.toThrow('Validation failed');
    await expect(store.deleteCoupon('coupon-1')).rejects.toThrow('Validation failed');
    await expect(store.createSharedSpace('Bad')).rejects.toThrow('Validation failed');

    expect(store.error).toBe('Validation failed');
  });

  it('falls back for delete/update mutations when network disappears', async () => {
    const store = await createSeededStore({ online: true, fetchMock: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });

    await store.renameGroup('group-1', 'Офлайн rename');
    await store.deleteGroup('group-1');
    store.groups = [group()];
    await store.updateCoupon('coupon-1', { title: 'Офлайн update' });
    await store.deleteCoupon('coupon-1');

    expect(store.isOffline).toBe(true);
    expect(store.pendingSyncCount).toBeGreaterThan(0);
  });

  it('returns from sync when offline or already syncing', async () => {
    const store = await createSeededStore({ online: false });
    await expect(store.syncPendingChanges()).resolves.toBeUndefined();

    store.isOnline = true;
    store.isSyncing = true;
    await expect(store.syncPendingChanges()).resolves.toBeUndefined();
  });

  it('throws when duplicate group cannot be resolved during sync', async () => {
    const store = await createSeededStore({ online: true });
    const localGroupId = createLocalId('group');
    await offlineDb.addQueueOperation({ id: 'sync-unresolved-group', entity: 'group', action: 'create', space_id: personalSpace.id, record_id: localGroupId, payload: { title: 'Не найдено' }, created_at: '1', updated_at: '1' });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === 'POST') return jsonResponse({ message: 'duplicate' }, 409);
      if (url.pathname.endsWith('/groups')) return jsonResponse([]);
      return jsonResponse({ message: 'Unhandled' }, 500);
    }));

    await expect(store.syncPendingChanges()).rejects.toThrow('duplicate');
    expect(store.syncError).toContain('duplicate');
  });

  it('throws unresolved duplicate coupon errors during sync', async () => {
    const store = await createSeededStore({ online: true });
    await offlineDb.addQueueOperation({ id: 'sync-unresolved-coupon', entity: 'coupon', action: 'create', space_id: personalSpace.id, record_id: createLocalId('coupon'), payload: { title: 'Дубль', qr_text: 'DUP', type: 'qr' }, created_at: '1', updated_at: '1' });
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ message: 'duplicate' }, 409)));

    await expect(store.syncPendingChanges()).rejects.toThrow('duplicate');
    expect(store.syncError).toContain('duplicate');
  });
});
