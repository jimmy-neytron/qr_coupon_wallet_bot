import type { AppUser, Coupon, CouponGroup, Space, SpaceMember } from '../types/domain';

const DB_NAME = 'qr_coupon_wallet_offline';
const DB_VERSION = 1;

export const LOCAL_ID_PREFIX = 'local_';

export type SyncEntity = 'group' | 'coupon';
export type SyncAction = 'create' | 'update' | 'delete';

export type SyncOperation = {
  id: string;
  entity: SyncEntity;
  action: SyncAction;
  space_id: string;
  record_id: string;
  payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OfflineSnapshot = {
  user: AppUser | null;
  spaces: Space[];
  selectedSpaceId: string | null;
  members: SpaceMember[];
  groups: CouponGroup[];
  coupons: Coupon[];
  pendingCount: number;
  lastSyncedAt: string | null;
};

type StoreName = 'meta' | 'user' | 'spaces' | 'members' | 'groups' | 'coupons' | 'sync_queue';

type MetaRecord = {
  key: string;
  value: unknown;
};


function toPlainRecord<T>(value: T): T {
  if (value === undefined || value === null) return value;

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function toPlainRecords<T>(values: T[]): T[] {
  return values.map((value) => toPlainRecord(value));
}

let dbPromise: Promise<IDBDatabase> | null = null;

function makeRequestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function makeTransactionPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('user')) db.createObjectStore('user', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('spaces')) db.createObjectStore('spaces', { keyPath: 'id' });

      if (!db.objectStoreNames.contains('members')) {
        const store = db.createObjectStore('members', { keyPath: 'local_key' });
        store.createIndex('space_id', 'space_id');
      }

      if (!db.objectStoreNames.contains('groups')) {
        const store = db.createObjectStore('groups', { keyPath: 'id' });
        store.createIndex('space_id', 'space_id');
      }

      if (!db.objectStoreNames.contains('coupons')) {
        const store = db.createObjectStore('coupons', { keyPath: 'id' });
        store.createIndex('space_id', 'space_id');
      }

      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
        store.createIndex('created_at', 'created_at');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });

  return dbPromise;
}

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return makeRequestPromise<T[]>(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

async function putRecord<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(toPlainRecord(value));
  await makeTransactionPromise(transaction);
}

async function putMany<T>(storeName: StoreName, values: T[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  toPlainRecords(values).forEach((value) => store.put(value));
  await makeTransactionPromise(transaction);
}

async function deleteRecord(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await makeTransactionPromise(transaction);
}

async function replaceBySpace<T extends { space_id: string }>(storeName: StoreName, spaceId: string, values: T[]): Promise<void> {
  const db = await openDatabase();
  const existing = await getAll<T>(storeName);
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  existing.filter((item) => item.space_id === spaceId).forEach((item) => store.delete((item as T & { id?: string; local_key?: string }).id ?? (item as T & { local_key: string }).local_key));
  toPlainRecords(values).forEach((value) => store.put(value));
  await makeTransactionPromise(transaction);
}

async function getMetaValue<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  const record = await makeRequestPromise<MetaRecord | undefined>(db.transaction('meta', 'readonly').objectStore('meta').get(key));
  return (record?.value as T | undefined) ?? null;
}

async function setMetaValue(key: string, value: unknown): Promise<void> {
  await putRecord<MetaRecord>('meta', { key, value });
}

function withLocalMemberKey(member: SpaceMember): SpaceMember & { local_key: string } {
  return {
    ...member,
    local_key: `${member.space_id}:${member.user_id}`,
  };
}

export function createLocalId(entity: string): string {
  return `${LOCAL_ID_PREFIX}${entity}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

export const offlineDb = {
  async loadSnapshot(spaceId?: string | null): Promise<OfflineSnapshot> {
    const [users, spaces, allMembers, allGroups, allCoupons, queue, selectedSpaceId, lastSyncedAt] = await Promise.all([
      getAll<AppUser>('user'),
      getAll<Space>('spaces'),
      getAll<SpaceMember & { local_key?: string }>('members'),
      getAll<CouponGroup>('groups'),
      getAll<Coupon>('coupons'),
      getAll<SyncOperation>('sync_queue'),
      getMetaValue<string>('selected_space_id'),
      getMetaValue<string>('last_synced_at'),
    ]);

    const nextSpaceId = spaceId ?? selectedSpaceId ?? spaces[0]?.id ?? null;

    return {
      user: users[0] ?? null,
      spaces,
      selectedSpaceId: nextSpaceId,
      members: nextSpaceId ? allMembers.filter((member) => member.space_id === nextSpaceId) : [],
      groups: nextSpaceId ? allGroups.filter((group) => group.space_id === nextSpaceId) : [],
      coupons: nextSpaceId ? allCoupons.filter((coupon) => coupon.space_id === nextSpaceId) : [],
      pendingCount: queue.length,
      lastSyncedAt,
    };
  },

  async saveSelectedSpaceId(spaceId: string | null): Promise<void> {
    await setMetaValue('selected_space_id', spaceId);
  },

  async saveLastSyncedAt(value: string): Promise<void> {
    await setMetaValue('last_synced_at', value);
  },

  async saveMe(user: AppUser, spaces: Space[]): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction(['user', 'spaces'], 'readwrite');
    transaction.objectStore('user').clear();
    transaction.objectStore('user').put(toPlainRecord(user));

    const spacesStore = transaction.objectStore('spaces');
    toPlainRecords(spaces).forEach((space) => spacesStore.put(space));
    await makeTransactionPromise(transaction);
  },

  async saveSpaces(spaces: Space[]): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction('spaces', 'readwrite');
    const store = transaction.objectStore('spaces');
    toPlainRecords(spaces).forEach((space) => store.put(space));
    await makeTransactionPromise(transaction);
  },

  async saveMembers(spaceId: string, members: SpaceMember[]): Promise<void> {
    await replaceBySpace('members', spaceId, members.map(withLocalMemberKey));
  },

  async saveGroups(spaceId: string, groups: CouponGroup[]): Promise<void> {
    await replaceBySpace('groups', spaceId, groups);
  },

  async saveCoupons(spaceId: string, coupons: Coupon[]): Promise<void> {
    await replaceBySpace('coupons', spaceId, coupons);
  },

  async upsertGroup(group: CouponGroup): Promise<void> {
    await putRecord('groups', group);
  },

  async removeGroup(groupId: string): Promise<void> {
    await deleteRecord('groups', groupId);
  },

  async upsertCoupon(coupon: Coupon): Promise<void> {
    await putRecord('coupons', coupon);
  },

  async removeCoupon(couponId: string): Promise<void> {
    await deleteRecord('coupons', couponId);
  },

  async getQueue(): Promise<SyncOperation[]> {
    return (await getAll<SyncOperation>('sync_queue')).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getPendingCount(): Promise<number> {
    return (await getAll<SyncOperation>('sync_queue')).length;
  },

  async addQueueOperation(operation: SyncOperation): Promise<void> {
    await putRecord('sync_queue', operation);
  },

  async removeQueueOperation(operationId: string): Promise<void> {
    await deleteRecord('sync_queue', operationId);
  },

  async removeQueueOperations(predicate: (operation: SyncOperation) => boolean): Promise<void> {
    const queue = await this.getQueue();
    const db = await openDatabase();
    const transaction = db.transaction('sync_queue', 'readwrite');
    const store = transaction.objectStore('sync_queue');

    queue.filter(predicate).forEach((operation) => store.delete(operation.id));
    await makeTransactionPromise(transaction);
  },

  async updateQueueOperations(mapper: (operation: SyncOperation) => SyncOperation): Promise<void> {
    const queue = await this.getQueue();
    await putMany('sync_queue', queue.map(mapper));
  },
};


export async function resetOfflineDatabaseForTests(): Promise<void> {
  const db = dbPromise ? await dbPromise.catch(() => null) : null;
  db?.close();
  dbPromise = null;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'));
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });
}
