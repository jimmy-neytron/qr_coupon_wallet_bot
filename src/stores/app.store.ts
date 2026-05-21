import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError, useApi } from '../composables/useApi';
import { createLocalId, isLocalId, offlineDb, type SyncOperation } from '../services/offlineDb';
import type {
  AppUser,
  Coupon,
  CouponGroup,
  CreateCouponPayload,
  Invite,
  MeResponse,
  Space,
  SpaceMember,
  UpdateCouponPayload,
} from '../types/domain';

const SELECTED_SPACE_KEY = 'qr_coupon_wallet:selected_space_id';

type DuplicateCouponDetails = {
  existing_coupon?: Coupon;
};

type LocalQueuePayload = Record<string, unknown>;

type OfflineFallbackReason = 'network' | 'manual-offline';

/**
 * Returns current timestamp in API-compatible ISO format.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Detects browser/network errors produced by failed fetch requests.
 */
export function isNetworkLikeError(value: unknown) {
  return value instanceof TypeError || (value instanceof Error && /fetch|network|failed|load failed|internet|offline/i.test(value.message));
}

/**
 * Server errors should not be silently saved offline, but a lost connection should.
 */
function canFallbackToOffline(value: unknown): boolean {
  return isNetworkLikeError(value) || (value instanceof ApiError && value.status === 0);
}

/**
 * Merges active and archived lists returned by API into one deduplicated list.
 */
function mergeCoupons(active: Coupon[], archived: Coupon[]) {
  const byId = new Map<string, Coupon>();
  [...active, ...archived].forEach((coupon) => byId.set(coupon.id, coupon));

  return [...byId.values()].sort(
    (a, b) => Number(b.is_favorite) - Number(a.is_favorite) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Converts unknown thrown values to a user-friendly message.
 */
function getApiErrorMessage(value: unknown): string {
  if (value instanceof ApiError) return value.message;
  if (value instanceof Error) return value.message;
  return 'Неизвестная ошибка';
}

/**
 * Creates a non-critical sync message when server data cannot be refreshed.
 */
function getOfflineFallbackMessage(value: unknown): string {
  if (value instanceof ApiError) {
    if (value.status === 401) return 'Не удалось подтвердить Telegram-сессию. Открыта локальная копия.';
    if (value.status === 403) return 'Нет доступа к этой коллекции на сервере. Открыта локальная копия.';
    return `Не удалось обновить данные с сервера: ${value.message}`;
  }

  if (isNetworkLikeError(value)) {
    return 'Сервер временно недоступен. Открыта локальная копия.';
  }

  return `Не удалось обновить данные с сервера: ${getApiErrorMessage(value)}`;
}

/**
 * Main data store. It keeps Supabase data and a local IndexedDB mirror in sync.
 */
export const useAppStore = defineStore('app', () => {
  const api = useApi();

  const user = ref<AppUser | null>(null);
  const spaces = ref<Space[]>([]);
  const selectedSpaceId = ref<string | null>(localStorage.getItem(SELECTED_SPACE_KEY));
  const members = ref<SpaceMember[]>([]);
  const groups = ref<CouponGroup[]>([]);
  const coupons = ref<Coupon[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
  const isSyncing = ref(false);
  const pendingSyncCount = ref(0);
  const lastSyncedAt = ref<string | null>(null);
  const hasOfflineCache = ref(false);
  const syncError = ref<string | null>(null);
  let networkListenersInitialized = false;

  const selectedSpace = computed(() => spaces.value.find((space) => space.id === selectedSpaceId.value) ?? null);
  const currentUserRole = computed(() => selectedSpace.value?.role ?? 'member');
  const isOwner = computed(() => currentUserRole.value === 'owner');
  const activeCoupons = computed(() => coupons.value.filter((coupon) => !coupon.is_archived));
  const archivedCoupons = computed(() => coupons.value.filter((coupon) => coupon.is_archived));
  const isOffline = computed(() => !isOnline.value);
  const hasPendingSync = computed(() => pendingSyncCount.value > 0);

  /**
   * Shows a critical UI error. Sync/network issues use syncError instead.
   */
  function setError(value: unknown) {
    if (value instanceof ApiError) {
      error.value = value.message;
      return;
    }

    error.value = value instanceof Error ? value.message : 'Неизвестная ошибка';
  }

  function clearError() {
    error.value = null;
  }

  /**
   * Switches the app into offline mode after failed network requests.
   */
  function markOfflineFromError(value: unknown) {
    if (canFallbackToOffline(value)) {
      isOnline.value = false;
    }
  }

  /**
   * Sets a friendly banner message when a mutation was saved locally.
   */
  function notifySavedOffline(reason: OfflineFallbackReason = 'network') {
    syncError.value = reason === 'manual-offline'
      ? 'Офлайн-режим: изменение сохранено локально и отправится позже.'
      : 'Связь с сервером пропала. Изменение сохранено локально и отправится позже.';
  }

  /**
   * Registers browser online/offline listeners once per application lifetime.
   */
  function setupNetworkListeners() {
    if (networkListenersInitialized || typeof window === 'undefined') return;
    networkListenersInitialized = true;

    window.addEventListener('online', () => {
      isOnline.value = true;
      void syncPendingChanges()
        .then(() => refreshCurrentSpace())
        .catch((err) => {
          markOfflineFromError(err);
          syncError.value = getOfflineFallbackMessage(err);
        });
    });

    window.addEventListener('offline', () => {
      isOnline.value = false;
      syncError.value = 'Офлайн-режим: новые изменения будут сохранены локально.';
    });
  }

  async function refreshPendingCount() {
    pendingSyncCount.value = await offlineDb.getPendingCount();
  }

  /**
   * Persists selected collection both in localStorage and IndexedDB.
   */
  async function rememberSelectedSpace(spaceId: string | null) {
    selectedSpaceId.value = spaceId;

    if (spaceId) {
      localStorage.setItem(SELECTED_SPACE_KEY, spaceId);
    } else {
      localStorage.removeItem(SELECTED_SPACE_KEY);
    }

    await offlineDb.saveSelectedSpaceId(spaceId);
  }

  /**
   * Applies an IndexedDB snapshot to reactive store state.
   */
  function applySnapshot(snapshot: {
    user: AppUser | null;
    spaces: Space[];
    selectedSpaceId: string | null;
    members: SpaceMember[];
    groups: CouponGroup[];
    coupons: Coupon[];
    pendingCount: number;
    lastSyncedAt: string | null;
  }) {
    user.value = snapshot.user;
    spaces.value = snapshot.spaces;
    selectedSpaceId.value = snapshot.selectedSpaceId;
    members.value = snapshot.members;
    groups.value = snapshot.groups;
    coupons.value = snapshot.coupons;
    pendingSyncCount.value = snapshot.pendingCount;
    lastSyncedAt.value = snapshot.lastSyncedAt;
    hasOfflineCache.value = Boolean(snapshot.user || snapshot.spaces.length || snapshot.groups.length || snapshot.coupons.length);
  }

  /**
   * Loads cached data for the selected or requested collection.
   */
  async function loadCachedSpace(spaceId: string | null = selectedSpaceId.value) {
    const snapshot = await offlineDb.loadSnapshot(spaceId);
    applySnapshot(snapshot);

    if (snapshot.selectedSpaceId) {
      selectedSpaceId.value = snapshot.selectedSpaceId;
      localStorage.setItem(SELECTED_SPACE_KEY, snapshot.selectedSpaceId);
    }

    return snapshot;
  }

  function createQueueOperation(
    entity: SyncOperation['entity'],
    action: SyncOperation['action'],
    spaceId: string,
    recordId: string,
    payload?: LocalQueuePayload,
  ): SyncOperation {
    return {
      id: createLocalId('sync'),
      entity,
      action,
      space_id: spaceId,
      record_id: recordId,
      payload,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
  }

  async function addQueueOperation(operation: SyncOperation) {
    await offlineDb.addQueueOperation(operation);
    await refreshPendingCount();
  }

  /**
   * Merges updates into a pending create/update operation to avoid duplicate queue items.
   */
  async function mergeQueuedCreateOrAddUpdate(
    entity: SyncOperation['entity'],
    spaceId: string,
    recordId: string,
    payload: LocalQueuePayload,
  ) {
    const queue = await offlineDb.getQueue();
    const createOperation = queue.find((operation) => operation.entity === entity && operation.action === 'create' && operation.record_id === recordId);

    if (createOperation) {
      await offlineDb.addQueueOperation({
        ...createOperation,
        payload: { ...(createOperation.payload ?? {}), ...payload },
        updated_at: nowIso(),
      });
      await refreshPendingCount();
      return;
    }

    const existingUpdate = queue.find((operation) => operation.entity === entity && operation.action === 'update' && operation.record_id === recordId);

    if (existingUpdate) {
      await offlineDb.addQueueOperation({
        ...existingUpdate,
        payload: { ...(existingUpdate.payload ?? {}), ...payload },
        updated_at: nowIso(),
      });
      await refreshPendingCount();
      return;
    }

    await addQueueOperation(createQueueOperation(entity, 'update', spaceId, recordId, payload));
  }

  async function removeQueuedOperationsForRecord(entity: SyncOperation['entity'], recordId: string) {
    await offlineDb.removeQueueOperations((operation) => operation.entity === entity && operation.record_id === recordId);
    await refreshPendingCount();
  }

  function assertOnline(actionText = 'Это действие') {
    if (!isOnline.value) {
      throw new ApiError(`${actionText} доступно только с интернетом. Локальные промокоды можно добавлять и смотреть офлайн.`, 0);
    }
  }

  function getLocalCreatedBy() {
    if (!user.value) return null;
    return {
      id: user.value.id,
      first_name: user.value.first_name,
      last_name: user.value.last_name,
      username: user.value.username,
    };
  }

  function findLocalCouponDuplicate(payload: CreateCouponPayload) {
    return coupons.value.find((coupon) => !coupon.is_archived && coupon.qr_text === payload.qr_text && coupon.space_id === selectedSpaceId.value);
  }

  /**
   * Creates a group locally and adds a create operation to the sync queue.
   */
  async function createGroupLocally(title: string, reason: OfflineFallbackReason = 'manual-offline') {
    if (!selectedSpaceId.value) throw new Error('Коллекция не выбрана');

    const group: CouponGroup = {
      id: createLocalId('group'),
      space_id: selectedSpaceId.value,
      title,
      created_at: nowIso(),
      updated_at: nowIso(),
      coupons_count: 0,
    };

    groups.value = [...groups.value, group].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    await offlineDb.upsertGroup(group);
    await addQueueOperation(createQueueOperation('group', 'create', selectedSpaceId.value, group.id, { title }));
    notifySavedOffline(reason);
    return group;
  }

  /**
   * Renames a group locally and queues the change for future sync.
   */
  async function renameGroupLocally(groupId: string, title: string, reason: OfflineFallbackReason = 'manual-offline') {
    const current = groups.value.find((group) => group.id === groupId);
    if (!current) throw new Error('Группа не найдена');

    const updated = { ...current, title, updated_at: nowIso() };
    groups.value = groups.value.map((group) => (group.id === groupId ? updated : group));
    await offlineDb.upsertGroup(updated);
    await mergeQueuedCreateOrAddUpdate('group', current.space_id, groupId, { title });
    notifySavedOffline(reason);
    return updated;
  }

  /**
   * Deletes a group locally. Server-side deletion is queued when the group already exists remotely.
   */
  async function deleteGroupLocally(groupId: string, reason: OfflineFallbackReason = 'manual-offline') {
    const current = groups.value.find((group) => group.id === groupId);

    groups.value = groups.value.filter((group) => group.id !== groupId);
    coupons.value = coupons.value.map((coupon) => (coupon.group_id === groupId ? { ...coupon, group_id: null, updated_at: nowIso() } : coupon));
    await offlineDb.removeGroup(groupId);
    if (selectedSpaceId.value) await offlineDb.saveCoupons(selectedSpaceId.value, coupons.value);

    if (isLocalId(groupId)) {
      await removeQueuedOperationsForRecord('group', groupId);
    } else if (current) {
      await offlineDb.removeQueueOperations((operation) => operation.entity === 'group' && operation.record_id === groupId && operation.action === 'update');
      await addQueueOperation(createQueueOperation('group', 'delete', current.space_id, groupId));
    }

    notifySavedOffline(reason);
  }

  /**
   * Creates a coupon locally and queues it. Used both in offline mode and after network loss.
   */
  async function createCouponLocally(payload: CreateCouponPayload, reason: OfflineFallbackReason = 'manual-offline') {
    if (!selectedSpaceId.value) throw new Error('Коллекция не выбрана');

    const duplicate = findLocalCouponDuplicate(payload);
    if (duplicate) {
      error.value = 'Такой купон уже есть в этой коллекции';
      throw new ApiError('Такой купон уже есть в этой коллекции', 409, { existing_coupon: duplicate });
    }

    const coupon: Coupon = {
      id: createLocalId('coupon'),
      space_id: selectedSpaceId.value,
      group_id: payload.group_id ?? null,
      created_by_user_id: user.value?.id ?? null,
      title: payload.title,
      qr_text: payload.qr_text,
      type: payload.type,
      note: payload.note ?? null,
      expires_at: payload.expires_at ?? null,
      is_favorite: false,
      is_archived: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: getLocalCreatedBy(),
    };

    coupons.value = [coupon, ...coupons.value];
    await offlineDb.upsertCoupon(coupon);
    await addQueueOperation(createQueueOperation('coupon', 'create', selectedSpaceId.value, coupon.id, { ...payload }));
    notifySavedOffline(reason);
    return coupon;
  }

  /**
   * Updates a coupon locally and merges the mutation into the sync queue.
   */
  async function updateCouponLocally(couponId: string, payload: UpdateCouponPayload, reason: OfflineFallbackReason = 'manual-offline') {
    const current = coupons.value.find((coupon) => coupon.id === couponId);
    if (!current) throw new Error('Купон не найден');

    const updated: Coupon = {
      ...current,
      ...payload,
      group_id: payload.group_id === undefined ? current.group_id : payload.group_id ?? null,
      note: payload.note === undefined ? current.note : payload.note ?? null,
      expires_at: payload.expires_at === undefined ? current.expires_at : payload.expires_at ?? null,
      updated_at: nowIso(),
    };

    coupons.value = coupons.value.map((coupon) => (coupon.id === updated.id ? updated : coupon));
    await offlineDb.upsertCoupon(updated);
    await mergeQueuedCreateOrAddUpdate('coupon', current.space_id, couponId, payload as LocalQueuePayload);
    notifySavedOffline(reason);
    return updated;
  }

  /**
   * Deletes a coupon locally and queues deletion for server records.
   */
  async function deleteCouponLocally(couponId: string, reason: OfflineFallbackReason = 'manual-offline') {
    const current = coupons.value.find((coupon) => coupon.id === couponId);

    coupons.value = coupons.value.filter((coupon) => coupon.id !== couponId);
    await offlineDb.removeCoupon(couponId);

    if (isLocalId(couponId)) {
      await removeQueuedOperationsForRecord('coupon', couponId);
    } else if (current) {
      await offlineDb.removeQueueOperations((operation) => operation.entity === 'coupon' && operation.record_id === couponId && operation.action === 'update');
      await addQueueOperation(createQueueOperation('coupon', 'delete', current.space_id, couponId));
    }

    notifySavedOffline(reason);
  }

  /**
   * Initializes user, collections and current collection data.
   * Cached data is shown first, then Supabase data refreshes it when available.
   */
  async function init() {
    setupNetworkListeners();
    isLoading.value = true;
    clearError();
    syncError.value = null;

    let cacheLoaded = false;

    try {
      const cached = await loadCachedSpace(selectedSpaceId.value);
      cacheLoaded = Boolean(cached.user || cached.spaces.length);
    } catch {
      cacheLoaded = false;
    }

    if (!isOnline.value) {
      if (!cacheLoaded) {
        isLoading.value = false;
        throw new ApiError('Нет интернета и нет сохранённой локальной копии. Открой приложение один раз онлайн, чтобы включить офлайн-режим.', 0);
      }

      syncError.value = 'Офлайн-режим: показываю последнюю сохранённую копию.';
      isLoading.value = false;
      return;
    }

    try {
      const data = await api.request<MeResponse>('/me');
      user.value = data.user;
      spaces.value = data.spaces;
      await offlineDb.saveMe(data.user, data.spaces);

      const rememberedSpaceExists = spaces.value.some((space) => space.id === selectedSpaceId.value);
      const nextSpaceId = rememberedSpaceExists ? selectedSpaceId.value : spaces.value[0]?.id ?? null;
      await rememberSelectedSpace(nextSpaceId);

      await syncPendingChanges();

      if (nextSpaceId) {
        await Promise.all([fetchMembers(), fetchGroups(), fetchCoupons()]);
      }

      const syncTime = nowIso();
      lastSyncedAt.value = syncTime;
      syncError.value = null;
      await offlineDb.saveLastSyncedAt(syncTime);
    } catch (err) {
      markOfflineFromError(err);

      if (cacheLoaded) {
        await loadCachedSpace(selectedSpaceId.value);
        error.value = null;
        syncError.value = getOfflineFallbackMessage(err);
        return;
      }

      setError(err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Selects a collection and loads its data from server or cache.
   */
  async function selectSpace(spaceId: string) {
    await rememberSelectedSpace(spaceId);
    isLoading.value = true;
    clearError();

    try {
      if (!isOnline.value) {
        await loadCachedSpace(spaceId);
        return;
      }

      await syncPendingChanges();
      await Promise.all([fetchMembers(), fetchGroups(), fetchCoupons()]);
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        await loadCachedSpace(spaceId);
        syncError.value = getOfflineFallbackMessage(err);
        return;
      }
      setError(err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchSpaces() {
    if (!isOnline.value) {
      const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
      spaces.value = snapshot.spaces;
      return;
    }

    try {
      spaces.value = await api.request<Space[]>('/spaces');
      await offlineDb.saveSpaces(spaces.value);

      if (!spaces.value.some((space) => space.id === selectedSpaceId.value)) {
        await rememberSelectedSpace(spaces.value[0]?.id ?? null);
      }
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
        spaces.value = snapshot.spaces;
        syncError.value = getOfflineFallbackMessage(err);
        return;
      }
      throw err;
    }
  }

  async function fetchMembers() {
    if (!selectedSpaceId.value) return;

    if (!isOnline.value) {
      const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
      members.value = snapshot.members;
      return;
    }

    try {
      members.value = await api.request<SpaceMember[]>(`/spaces/${selectedSpaceId.value}/members`);
      await offlineDb.saveMembers(selectedSpaceId.value, members.value);
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
        members.value = snapshot.members;
        syncError.value = getOfflineFallbackMessage(err);
        return;
      }
      throw err;
    }
  }

  async function fetchGroups() {
    if (!selectedSpaceId.value) return;

    if (!isOnline.value) {
      const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
      groups.value = snapshot.groups;
      return;
    }

    try {
      groups.value = await api.request<CouponGroup[]>(`/spaces/${selectedSpaceId.value}/groups`);
      await offlineDb.saveGroups(selectedSpaceId.value, groups.value);
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
        groups.value = snapshot.groups;
        syncError.value = getOfflineFallbackMessage(err);
        return;
      }
      throw err;
    }
  }

  async function fetchCoupons(_options: { archived?: boolean } = {}) {
    if (!selectedSpaceId.value) return;

    if (!isOnline.value) {
      const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
      coupons.value = snapshot.coupons;
      return;
    }

    try {
      const [active, archived] = await Promise.all([
        api.request<Coupon[]>(`/spaces/${selectedSpaceId.value}/coupons`, { query: { archived: false } }),
        api.request<Coupon[]>(`/spaces/${selectedSpaceId.value}/coupons`, { query: { archived: true } }),
      ]);

      coupons.value = mergeCoupons(active, archived);
      await offlineDb.saveCoupons(selectedSpaceId.value, coupons.value);
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        const snapshot = await offlineDb.loadSnapshot(selectedSpaceId.value);
        coupons.value = snapshot.coupons;
        syncError.value = getOfflineFallbackMessage(err);
        return;
      }
      throw err;
    }
  }

  /**
   * Refreshes current collection while preserving offline UX on network loss.
   */
  async function refreshCurrentSpace() {
    if (!selectedSpaceId.value) return;

    if (isOnline.value) {
      try {
        await syncPendingChanges();
        await Promise.all([fetchMembers(), fetchGroups(), fetchCoupons()]);
        const syncTime = nowIso();
        lastSyncedAt.value = syncTime;
        syncError.value = null;
        await offlineDb.saveLastSyncedAt(syncTime);
        return;
      } catch (err) {
        markOfflineFromError(err);
        if (!canFallbackToOffline(err)) throw err;
        syncError.value = getOfflineFallbackMessage(err);
      }
    }

    await loadCachedSpace(selectedSpaceId.value);
  }

  async function createSharedSpace(title: string) {
    assertOnline('Создание общей коллекции');
    isSaving.value = true;
    clearError();

    try {
      const space = await api.request<Space>('/spaces', {
        method: 'POST',
        body: { title },
      });

      await fetchSpaces();
      await selectSpace(space.id);
      return space;
    } catch (err) {
      markOfflineFromError(err);
      setError(err);
      throw err;
    } finally {
      isSaving.value = false;
    }
  }

  async function renameSpace(spaceId: string, title: string) {
    assertOnline('Переименование коллекции');
    const updated = await api.request<Space>(`/spaces/${spaceId}`, {
      method: 'PATCH',
      body: { title },
    });

    spaces.value = spaces.value.map((space) => (space.id === updated.id ? { ...space, ...updated } : space));
    await offlineDb.saveSpaces(spaces.value);
    return updated;
  }

  async function deleteSpace(spaceId: string) {
    assertOnline('Удаление коллекции');
    await api.request<{ ok: true }>(`/spaces/${spaceId}`, { method: 'DELETE' });
    await fetchSpaces();

    if (selectedSpaceId.value === spaceId) {
      await selectSpace(spaces.value[0]?.id ?? '');
    }
  }

  async function createInvite() {
    assertOnline('Создание приглашения');
    if (!selectedSpaceId.value) throw new Error('Коллекция не выбрана');

    return api.request<Invite>(`/spaces/${selectedSpaceId.value}/invites`, {
      method: 'POST',
    });
  }

  async function acceptInvite(code: string) {
    assertOnline('Вход по коду');
    const result = await api.request<{ space: Space }>('/invites/accept', {
      method: 'POST',
      body: { code },
    });

    await fetchSpaces();
    await selectSpace(result.space.id);
    return result.space;
  }

  async function createGroup(title: string) {
    if (!selectedSpaceId.value) throw new Error('Коллекция не выбрана');

    if (!isOnline.value) {
      return createGroupLocally(title, 'manual-offline');
    }

    try {
      const group = await api.request<CouponGroup>(`/spaces/${selectedSpaceId.value}/groups`, {
        method: 'POST',
        body: { title },
      });

      groups.value = [...groups.value, { ...group, coupons_count: 0 }].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      await offlineDb.upsertGroup({ ...group, coupons_count: 0 });
      syncError.value = null;
      return group;
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) return createGroupLocally(title, 'network');
      setError(err);
      throw err;
    }
  }

  async function renameGroup(groupId: string, title: string) {
    const current = groups.value.find((group) => group.id === groupId);
    if (!current) throw new Error('Группа не найдена');

    if (!isOnline.value) {
      return renameGroupLocally(groupId, title, 'manual-offline');
    }

    try {
      const updated = await api.request<CouponGroup>(`/groups/${groupId}`, {
        method: 'PATCH',
        body: { title },
      });

      groups.value = groups.value.map((group) => (group.id === updated.id ? { ...group, ...updated } : group));
      await offlineDb.upsertGroup(updated);
      syncError.value = null;
      return updated;
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) return renameGroupLocally(groupId, title, 'network');
      setError(err);
      throw err;
    }
  }

  async function deleteGroup(groupId: string) {
    if (!isOnline.value) {
      await deleteGroupLocally(groupId, 'manual-offline');
      return;
    }

    try {
      await api.request<{ ok: true }>(`/groups/${groupId}`, { method: 'DELETE' });
      groups.value = groups.value.filter((group) => group.id !== groupId);
      coupons.value = coupons.value.map((coupon) => (coupon.group_id === groupId ? { ...coupon, group_id: null } : coupon));
      await offlineDb.removeGroup(groupId);
      if (selectedSpaceId.value) await offlineDb.saveCoupons(selectedSpaceId.value, coupons.value);
      syncError.value = null;
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        await deleteGroupLocally(groupId, 'network');
        return;
      }
      setError(err);
      throw err;
    }
  }

  async function createCoupon(payload: CreateCouponPayload) {
    if (!selectedSpaceId.value) throw new Error('Коллекция не выбрана');
    isSaving.value = true;
    clearError();

    try {
      if (!isOnline.value) {
        return await createCouponLocally(payload, 'manual-offline');
      }

      const coupon = await api.request<Coupon>(`/spaces/${selectedSpaceId.value}/coupons`, {
        method: 'POST',
        body: payload,
      });

      coupons.value = [coupon, ...coupons.value];
      await offlineDb.upsertCoupon(coupon);
      syncError.value = null;
      return coupon;
    } catch (err) {
      markOfflineFromError(err);

      if (err instanceof ApiError && err.status === 409) {
        const details = err.details as DuplicateCouponDetails | undefined;
        error.value = 'Такой купон уже есть в этой коллекции';
        throw new ApiError('Такой купон уже есть в этой коллекции', 409, details);
      }

      if (canFallbackToOffline(err)) {
        return await createCouponLocally(payload, 'network');
      }

      setError(err);
      throw err;
    } finally {
      isSaving.value = false;
    }
  }

  async function updateCoupon(couponId: string, payload: UpdateCouponPayload) {
    const current = coupons.value.find((coupon) => coupon.id === couponId);
    if (!current) throw new Error('Купон не найден');

    if (!isOnline.value) {
      return updateCouponLocally(couponId, payload, 'manual-offline');
    }

    try {
      const updated = await api.request<Coupon>(`/coupons/${couponId}`, {
        method: 'PATCH',
        body: payload,
      });

      coupons.value = coupons.value.map((coupon) => (coupon.id === updated.id ? updated : coupon));
      await offlineDb.upsertCoupon(updated);
      syncError.value = null;
      return updated;
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) return updateCouponLocally(couponId, payload, 'network');
      setError(err);
      throw err;
    }
  }

  async function deleteCoupon(couponId: string) {
    if (!isOnline.value) {
      await deleteCouponLocally(couponId, 'manual-offline');
      return;
    }

    try {
      await api.request<{ ok: true }>(`/coupons/${couponId}`, { method: 'DELETE' });
      coupons.value = coupons.value.filter((coupon) => coupon.id !== couponId);
      await offlineDb.removeCoupon(couponId);
      syncError.value = null;
    } catch (err) {
      markOfflineFromError(err);
      if (canFallbackToOffline(err)) {
        await deleteCouponLocally(couponId, 'network');
        return;
      }
      setError(err);
      throw err;
    }
  }

  async function replaceLocalGroupId(localId: string, serverGroup: CouponGroup) {
    groups.value = groups.value.map((group) => (group.id === localId ? serverGroup : group));
    coupons.value = coupons.value.map((coupon) => (coupon.group_id === localId ? { ...coupon, group_id: serverGroup.id } : coupon));

    await offlineDb.removeGroup(localId);
    await offlineDb.upsertGroup(serverGroup);
    if (selectedSpaceId.value) await offlineDb.saveCoupons(selectedSpaceId.value, coupons.value);

    await offlineDb.updateQueueOperations((operation) => {
      const nextPayload = { ...(operation.payload ?? {}) };
      if (nextPayload.group_id === localId) nextPayload.group_id = serverGroup.id;

      return {
        ...operation,
        record_id: operation.entity === 'group' && operation.record_id === localId ? serverGroup.id : operation.record_id,
        payload: nextPayload,
      };
    });
  }

  async function replaceLocalCouponId(localId: string, serverCoupon: Coupon) {
    coupons.value = coupons.value.map((coupon) => (coupon.id === localId ? serverCoupon : coupon));
    await offlineDb.removeCoupon(localId);
    await offlineDb.upsertCoupon(serverCoupon);

    await offlineDb.updateQueueOperations((operation) => ({
      ...operation,
      record_id: operation.entity === 'coupon' && operation.record_id === localId ? serverCoupon.id : operation.record_id,
    }));
  }

  /**
   * Sends queued local operations to Supabase in chronological order.
   */
  async function syncPendingChanges() {
    if (!isOnline.value || isSyncing.value) return;

    const queue = await offlineDb.getQueue();
    pendingSyncCount.value = queue.length;
    if (queue.length === 0) return;

    isSyncing.value = true;
    syncError.value = null;

    try {
      for (const operation of queue) {
        if (operation.entity === 'group' && operation.action === 'create') {
          try {
            const created = await api.request<CouponGroup>(`/spaces/${operation.space_id}/groups`, {
              method: 'POST',
              body: { title: operation.payload?.title },
            });
            await replaceLocalGroupId(operation.record_id, created);
            await offlineDb.removeQueueOperation(operation.id);
          } catch (err) {
            if (err instanceof ApiError && err.status === 409 && operation.payload?.title) {
              const remoteGroups = await api.request<CouponGroup[]>(`/spaces/${operation.space_id}/groups`);
              const existing = remoteGroups.find((group) => group.title.trim().toLowerCase() === String(operation.payload?.title).trim().toLowerCase());

              if (existing) {
                await replaceLocalGroupId(operation.record_id, existing);
                await offlineDb.removeQueueOperation(operation.id);
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
        }

        if (operation.entity === 'group' && operation.action === 'update') {
          const updated = await api.request<CouponGroup>(`/groups/${operation.record_id}`, {
            method: 'PATCH',
            body: { title: operation.payload?.title },
          });
          groups.value = groups.value.map((group) => (group.id === updated.id ? { ...group, ...updated } : group));
          await offlineDb.upsertGroup(updated);
          await offlineDb.removeQueueOperation(operation.id);
        }

        if (operation.entity === 'group' && operation.action === 'delete') {
          await api.request<{ ok: true }>(`/groups/${operation.record_id}`, { method: 'DELETE' });
          await offlineDb.removeQueueOperation(operation.id);
        }

        if (operation.entity === 'coupon' && operation.action === 'create') {
          const payload = { ...(operation.payload ?? {}) };

          try {
            const created = await api.request<Coupon>(`/spaces/${operation.space_id}/coupons`, {
              method: 'POST',
              body: payload,
            });
            await replaceLocalCouponId(operation.record_id, created);
            await offlineDb.removeQueueOperation(operation.id);
          } catch (err) {
            const existingCoupon = err instanceof ApiError ? (err.details as DuplicateCouponDetails | undefined)?.existing_coupon : undefined;

            if (err instanceof ApiError && err.status === 409 && existingCoupon) {
              await replaceLocalCouponId(operation.record_id, existingCoupon);
              await offlineDb.removeQueueOperation(operation.id);
            } else {
              throw err;
            }
          }
        }

        if (operation.entity === 'coupon' && operation.action === 'update') {
          const payload = { ...(operation.payload ?? {}) };
          const updated = await api.request<Coupon>(`/coupons/${operation.record_id}`, {
            method: 'PATCH',
            body: payload,
          });
          coupons.value = coupons.value.map((coupon) => (coupon.id === updated.id ? updated : coupon));
          await offlineDb.upsertCoupon(updated);
          await offlineDb.removeQueueOperation(operation.id);
        }

        if (operation.entity === 'coupon' && operation.action === 'delete') {
          await api.request<{ ok: true }>(`/coupons/${operation.record_id}`, { method: 'DELETE' });
          await offlineDb.removeQueueOperation(operation.id);
        }

        await refreshPendingCount();
      }

      const syncTime = nowIso();
      lastSyncedAt.value = syncTime;
      syncError.value = null;
      await offlineDb.saveLastSyncedAt(syncTime);
    } catch (err) {
      markOfflineFromError(err);
      syncError.value = err instanceof Error ? err.message : 'Не удалось синхронизировать изменения';
      throw err;
    } finally {
      isSyncing.value = false;
      await refreshPendingCount();
    }
  }

  return {
    user,
    spaces,
    selectedSpaceId,
    selectedSpace,
    members,
    groups,
    coupons,
    activeCoupons,
    archivedCoupons,
    currentUserRole,
    isOwner,
    isLoading,
    isSaving,
    error,
    isOnline,
    isOffline,
    isSyncing,
    pendingSyncCount,
    hasPendingSync,
    lastSyncedAt,
    hasOfflineCache,
    syncError,
    clearError,
    init,
    selectSpace,
    refreshCurrentSpace,
    syncPendingChanges,
    fetchSpaces,
    fetchMembers,
    fetchGroups,
    fetchCoupons,
    createSharedSpace,
    renameSpace,
    deleteSpace,
    createInvite,
    acceptInvite,
    createGroup,
    renameGroup,
    deleteGroup,
    createCoupon,
    updateCoupon,
    deleteCoupon,
  };
});
