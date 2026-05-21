import 'fake-indexeddb/auto';
import { reactive } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppUser, Coupon, CouponGroup, Space, SpaceMember } from '../../types/domain';
import { createLocalId, isLocalId, offlineDb, resetOfflineDatabaseForTests, type SyncOperation } from '../offlineDb';

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

function makeGroup(id: string, spaceId: string, title: string): CouponGroup {
  return {
    id,
    space_id: spaceId,
    title,
    created_at: createdAt,
    updated_at: createdAt,
    coupons_count: 0,
  };
}

function makeCoupon(id: string, spaceId: string, groupId: string | null, title: string): Coupon {
  return {
    id,
    space_id: spaceId,
    group_id: groupId,
    created_by_user_id: user.id,
    title,
    qr_text: `QR:${id}`,
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
  };
}

beforeEach(async () => {
  await resetOfflineDatabaseForTests();
});

describe('offlineDb', () => {
  it('creates local ids with expected prefix', () => {
    const id = createLocalId('coupon');

    expect(isLocalId(id)).toBe(true);
    expect(id).toContain('local_coupon_');
  });

  it('saves and loads user, spaces, selected space, groups, members and coupons', async () => {
    const group = makeGroup('group-1', personalSpace.id, 'Магнит');
    const coupon = makeCoupon('coupon-1', personalSpace.id, group.id, 'Скидка 10%');
    const member: SpaceMember = {
      space_id: personalSpace.id,
      user_id: user.id,
      role: 'owner',
      created_at: createdAt,
      user,
    };

    await offlineDb.saveMe(user, [personalSpace, sharedSpace]);
    await offlineDb.saveSelectedSpaceId(personalSpace.id);
    await offlineDb.saveMembers(personalSpace.id, [member]);
    await offlineDb.saveGroups(personalSpace.id, [group]);
    await offlineDb.saveCoupons(personalSpace.id, [coupon]);
    await offlineDb.saveLastSyncedAt(createdAt);

    const snapshot = await offlineDb.loadSnapshot(personalSpace.id);

    expect(snapshot.user).toEqual(user);
    expect(snapshot.spaces).toHaveLength(2);
    expect(snapshot.selectedSpaceId).toBe(personalSpace.id);
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.groups).toEqual([group]);
    expect(snapshot.coupons).toEqual([coupon]);
    expect(snapshot.lastSyncedAt).toBe(createdAt);
  });

  it('loads data only for requested space', async () => {
    const personalGroup = makeGroup('group-personal', personalSpace.id, 'Магнит');
    const sharedGroup = makeGroup('group-shared', sharedSpace.id, 'Золотое яблоко');
    const personalCoupon = makeCoupon('coupon-personal', personalSpace.id, personalGroup.id, 'Личный купон');
    const sharedCoupon = makeCoupon('coupon-shared', sharedSpace.id, sharedGroup.id, 'Общий купон');

    await offlineDb.saveMe(user, [personalSpace, sharedSpace]);
    await offlineDb.saveGroups(personalSpace.id, [personalGroup]);
    await offlineDb.saveGroups(sharedSpace.id, [sharedGroup]);
    await offlineDb.saveCoupons(personalSpace.id, [personalCoupon]);
    await offlineDb.saveCoupons(sharedSpace.id, [sharedCoupon]);

    const sharedSnapshot = await offlineDb.loadSnapshot(sharedSpace.id);

    expect(sharedSnapshot.groups).toEqual([sharedGroup]);
    expect(sharedSnapshot.coupons).toEqual([sharedCoupon]);
  });

  it('keeps queue operations ordered and removable', async () => {
    const firstOperation: SyncOperation = {
      id: 'sync-1',
      entity: 'coupon',
      action: 'create',
      space_id: personalSpace.id,
      record_id: 'coupon-1',
      payload: { title: 'Первый' },
      created_at: '2026-05-21T12:00:00.000Z',
      updated_at: '2026-05-21T12:00:00.000Z',
    };

    const secondOperation: SyncOperation = {
      id: 'sync-2',
      entity: 'group',
      action: 'update',
      space_id: personalSpace.id,
      record_id: 'group-1',
      payload: { title: 'Магнит' },
      created_at: '2026-05-21T13:00:00.000Z',
      updated_at: '2026-05-21T13:00:00.000Z',
    };

    await offlineDb.addQueueOperation(secondOperation);
    await offlineDb.addQueueOperation(firstOperation);

    expect(await offlineDb.getPendingCount()).toBe(2);
    expect((await offlineDb.getQueue()).map((operation) => operation.id)).toEqual(['sync-1', 'sync-2']);

    await offlineDb.removeQueueOperation('sync-1');

    expect(await offlineDb.getPendingCount()).toBe(1);
    expect((await offlineDb.getQueue()).map((operation) => operation.id)).toEqual(['sync-2']);
  });

  it('updates queued operations with mapper', async () => {
    const operation: SyncOperation = {
      id: 'sync-1',
      entity: 'coupon',
      action: 'create',
      space_id: personalSpace.id,
      record_id: 'local_coupon_1',
      payload: { title: 'До синхронизации' },
      created_at: createdAt,
      updated_at: createdAt,
    };

    await offlineDb.addQueueOperation(operation);
    await offlineDb.updateQueueOperations((item) => ({
      ...item,
      record_id: item.record_id === 'local_coupon_1' ? 'remote-coupon-1' : item.record_id,
      updated_at: '2026-05-21T14:00:00.000Z',
    }));

    const [updated] = await offlineDb.getQueue();

    expect(updated.record_id).toBe('remote-coupon-1');
    expect(updated.updated_at).toBe('2026-05-21T14:00:00.000Z');
  });

  it('saves Vue reactive objects without IndexedDB clone errors', async () => {
    const group = reactive(makeGroup('group-reactive', personalSpace.id, 'Реактивная группа'));
    const coupon = reactive(makeCoupon('coupon-reactive', personalSpace.id, group.id, 'Реактивный купон'));
    const operation = reactive<SyncOperation>({
      id: 'sync-reactive',
      entity: 'group',
      action: 'delete',
      space_id: personalSpace.id,
      record_id: group.id,
      payload: { title: group.title },
      created_at: createdAt,
      updated_at: createdAt,
    });

    await offlineDb.upsertGroup(group);
    await offlineDb.upsertCoupon(coupon);
    await offlineDb.addQueueOperation(operation);

    const snapshot = await offlineDb.loadSnapshot(personalSpace.id);
    const queue = await offlineDb.getQueue();

    expect(snapshot.groups[0]).toEqual(makeGroup('group-reactive', personalSpace.id, 'Реактивная группа'));
    expect(snapshot.coupons[0].title).toBe('Реактивный купон');
    expect(queue[0].record_id).toBe('group-reactive');
  });

});
