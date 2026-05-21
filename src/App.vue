<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import CouponFormModal from './components/CouponFormModal.vue';
import InviteModal from './components/InviteModal.vue';
import LoadingSpinner from './components/LoadingSpinner.vue';
import QrCodeViewer from './components/QrCodeViewer.vue';
import TextInputModal from './components/TextInputModal.vue';
import AppToastStack from './components/ui/AppToastStack.vue';
import { ApiError } from './composables/useApi';
import { useTelegram } from './composables/useTelegram';
import { walletUiKey } from './composables/walletUi';
import { useAppStore } from './stores/app.store';
import type { Coupon, CouponGroup, CouponType, CreateCouponPayload, Invite } from './types/domain';
import { displayUserName, normalizeSearch } from './utils/text';

const store = useAppStore();
const telegram = useTelegram();
const router = useRouter();
const route = useRoute();

type GroupFilter = string | null | 'all';
type TextModalMode = 'create-group' | 'rename-group' | 'create-space' | 'join-code';
type AppTab = 'home' | 'groups' | 'profile';
type CouponCardPendingAction = 'favorite' | 'archive' | 'restore' | 'remove' | null;

const activeGroupId = ref<GroupFilter>('all');
const search = ref('');
const showArchived = ref(false);
const couponFormOpen = ref(false);
const couponViewerOpen = ref(false);
const inviteModalOpen = ref(false);
const selectedCoupon = ref<Coupon | null>(null);
const editingCoupon = ref<Coupon | null>(null);
const scannedQrText = ref('');
const formInitialGroupId = ref<string | null>(null);
const formInitialType = ref<CouponType>('qr');
const invite = ref<Invite | null>(null);
const successMessage = ref<string | null>(null);
const textModalOpen = ref(false);
const textModalMode = ref<TextModalMode>('create-group');
const textModalGroup = ref<CouponGroup | null>(null);
const pendingActions = ref<Record<string, boolean>>({});

const activeTab = computed<AppTab>(() => {
  if (route.name === 'groups') return 'groups';
  if (route.name === 'profile') return 'profile';
  return 'home';
});

const activeTabLabel = computed(() => {
  if (activeTab.value === 'groups') return 'Категории';
  if (activeTab.value === 'profile') return 'Профиль';
  return 'Промокоды';
});

const currentUserName = computed(() => {
  const user = store.user;
  if (!user) return 'Гость';
  return user.first_name || user.username || 'Пользователь';
});

const profileInitial = computed(() => currentUserName.value.slice(0, 1).toUpperCase());
const pendingSpaceId = computed(() => getPendingKeyByPrefix('space:select:')?.replace('space:select:', '') ?? null);
const isScanning = computed(() => isActionPending('scan'));
const isCouponSaving = computed(() => store.isSaving || isActionPending('coupon:save'));
const isTextModalSubmitting = computed(() => isActionPending(`text-modal:${textModalMode.value}`));
const isInviteCreating = computed(() => isActionPending('invite:create'));
const isArchiveFilterLoading = computed(() => isActionPending('coupons:archive-filter'));

const activeSpaceBadge = computed(() => {
  if (!store.selectedSpace) return 'Коллекция не выбрана';
  return store.selectedSpace.type === 'shared' ? `Общее · ${store.selectedSpace.title}` : `Личное · ${store.selectedSpace.title}`;
});

const visibleGroupsPreview = computed(() => groupsWithCounts.value.slice(0, 6));

const syncStatusTitle = computed(() => {
  if (store.isSyncing) return 'Синхронизирую изменения';
  if (store.syncError) return store.pendingSyncCount > 0 ? 'Есть изменения для синхронизации' : 'Открыта локальная копия';
  if (store.isOffline && store.pendingSyncCount > 0) return 'Офлайн · есть несохранённые изменения';
  if (store.isOffline) return 'Офлайн-режим';
  if (store.pendingSyncCount > 0) return 'Ожидает синхронизации';
  return 'Данные синхронизированы';
});

const syncStatusText = computed(() => {
  if (store.isSyncing) return 'Отправляю локальные изменения в Supabase.';
  if (store.syncError) return store.syncError;
  if (store.isOffline && store.pendingSyncCount > 0) return `Изменений в очереди: ${store.pendingSyncCount}. Они отправятся, когда появится интернет.`;
  if (store.isOffline) return 'Можно смотреть купоны и добавлять новые локально.';
  if (store.pendingSyncCount > 0) return `Изменений в очереди: ${store.pendingSyncCount}.`;
  return store.lastSyncedAt ? `Последняя синхронизация: ${new Date(store.lastSyncedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Локальная копия готова для офлайна.';
});

const visibleCouponsBase = computed(() => (showArchived.value ? store.archivedCoupons : store.activeCoupons));

const groupsWithCounts = computed(() => {
  const counts = new Map<string | null, number>();

  visibleCouponsBase.value.forEach((coupon) => {
    counts.set(coupon.group_id, (counts.get(coupon.group_id) ?? 0) + 1);
  });

  return store.groups.map((group) => ({
    ...group,
    coupons_count: counts.get(group.id) ?? 0,
  }));
});

const ungroupedCount = computed(() => visibleCouponsBase.value.filter((coupon) => coupon.group_id === null).length);

const filteredCoupons = computed(() => {
  const query = normalizeSearch(search.value);

  return visibleCouponsBase.value
    .filter((coupon) => activeGroupId.value === 'all' || coupon.group_id === activeGroupId.value)
    .filter((coupon) => {
      if (!query) return true;

      const groupTitle = store.groups.find((group) => group.id === coupon.group_id)?.title ?? 'без группы';
      return [coupon.title, coupon.qr_text, coupon.note, groupTitle]
        .filter(Boolean)
        .some((value) => normalizeSearch(String(value)).includes(query));
    })
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
});

const favoriteCount = computed(() => store.activeCoupons.filter((coupon) => coupon.is_favorite).length);
const archivedCount = computed(() => store.archivedCoupons.length);
const qrCouponsCount = computed(() => store.activeCoupons.filter((coupon) => coupon.type === 'qr').length);
const textCouponsCount = computed(() => store.activeCoupons.filter((coupon) => coupon.type === 'text').length);

const activeGroupTitle = computed(() => {
  if (activeGroupId.value === 'all') return 'Все купоны';
  if (activeGroupId.value === null) return 'Без группы';
  return store.groups.find((group) => group.id === activeGroupId.value)?.title ?? 'Группа';
});

const workspaceSubtitle = computed(() => {
  if (!store.selectedSpace) return 'Коллекция не выбрана';
  if (store.selectedSpace.type === 'personal') return 'Личная коллекция · доступ только у тебя';
  return `Общая коллекция · участников: ${store.members.length}`;
});

const textModalConfig = computed(() => {
  switch (textModalMode.value) {
    case 'rename-group':
      return {
        title: 'Переименовать группу',
        subtitle: 'Новое название будет видно всем, у кого есть доступ к этой коллекции.',
        label: 'Название группы',
        placeholder: 'Например, Золотое яблоко',
        initialValue: textModalGroup.value?.title ?? '',
        confirmText: 'Сохранить',
      };
    case 'create-space':
      return {
        title: 'Общая коллекция',
        subtitle: 'Создай отдельную коллекцию, куда можно пригласить девушку, семью или друзей.',
        label: 'Название коллекции',
        placeholder: 'Например, Наши купоны',
        initialValue: 'Наши купоны',
        confirmText: 'Создать',
      };
    case 'join-code':
      return {
        title: 'Войти по коду',
        subtitle: 'Введи код приглашения, который тебе отправили.',
        label: 'Код приглашения',
        placeholder: 'ABCD-1234',
        initialValue: '',
        confirmText: 'Присоединиться',
      };
    case 'create-group':
    default:
      return {
        title: 'Новая группа',
        subtitle: 'Группы помогают быстро находить купоны по магазинам и категориям.',
        label: 'Название группы',
        placeholder: 'Например, Магнит',
        initialValue: '',
        confirmText: 'Создать',
      };
  }
});

/** Checks if a UI action is currently locked to prevent double clicks. */
function isActionPending(key: string) {
  return Boolean(pendingActions.value[key]);
}

/** Locks or unlocks a concrete UI action key. */
function setActionPending(key: string, value: boolean) {
  const nextState = { ...pendingActions.value };

  if (value) {
    nextState[key] = true;
  } else {
    delete nextState[key];
  }

  pendingActions.value = nextState;
}

function getPendingKeyByPrefix(prefix: string) {
  return Object.keys(pendingActions.value).find((key) => key.startsWith(prefix)) ?? null;
}

/** Runs an action once and unlocks the key after completion. */
async function runLockedAction(key: string, action: () => Promise<void>, success?: string) {
  if (isActionPending(key)) return;

  setActionPending(key, true);

  try {
    await safeAction(action, success);
  } finally {
    setActionPending(key, false);
  }
}

function setTab(tab: AppTab) {
  void router.push(tab === 'home' ? '/' : `/${tab}`);
}

function memberDisplayName(member: { user?: { first_name?: string | null; last_name?: string | null; username?: string | null } | null }) {
  return displayUserName(member.user);
}

function toggleArchivedFilter() {
  if (isArchiveFilterLoading.value) return;
  showArchived.value = !showArchived.value;
}

function getCouponGroup(coupon: Coupon): CouponGroup | null {
  return store.groups.find((group) => group.id === coupon.group_id) ?? null;
}

function getCouponPendingAction(coupon: Coupon): CouponCardPendingAction {
  if (isActionPending(`coupon:favorite:${coupon.id}`)) return 'favorite';
  if (isActionPending(`coupon:archive:${coupon.id}`)) return 'archive';
  if (isActionPending(`coupon:restore:${coupon.id}`)) return 'restore';
  if (isActionPending(`coupon:delete:${coupon.id}`)) return 'remove';
  return null;
}

function getGroupPendingAction(group: CouponGroup): 'remove' | null {
  return isActionPending(`group:delete:${group.id}`) ? 'remove' : null;
}

function showSuccess(message: string) {
  successMessage.value = null;
  window.setTimeout(() => {
    successMessage.value = message;
  }, 0);
}

/** Wraps async actions with error toasts and haptic feedback. */
async function safeAction(action: () => Promise<void>, success?: string) {
  store.clearError();

  try {
    await action();
    if (success) showSuccess(success);
    telegram.hapticSuccess();
  } catch (err) {
    if (err instanceof ApiError) {
      store.error = err.message;
    } else {
      store.error = err instanceof Error ? err.message : 'Неизвестная ошибка';
    }
    telegram.hapticError();
  }
}

async function syncNow() {
  if (store.isOffline || store.isSyncing) return;

  await runLockedAction('sync:manual', async () => {
    await store.syncPendingChanges();
    await store.refreshCurrentSpace();
  }, 'Синхронизировано');
}

async function selectSpace(spaceId: string) {
  await runLockedAction(`space:select:${spaceId}`, async () => {
    await store.selectSpace(spaceId);
    activeGroupId.value = 'all';
  });
}

async function scanCoupon() {
  if (isActionPending('scan')) return;

  setActionPending('scan', true);
  store.clearError();

  try {
    telegram.hapticLight();
    const value = await telegram.scanQrCode('Наведите камеру на QR-код купона');

    if (!value) return;

    editingCoupon.value = null;
    scannedQrText.value = value;
    formInitialType.value = 'qr';
    formInitialGroupId.value = activeGroupId.value === 'all' ? null : activeGroupId.value;
    couponFormOpen.value = true;
  } catch (err) {
    if (err instanceof ApiError) {
      store.error = err.message;
    } else {
      store.error = err instanceof Error ? err.message : 'Не удалось открыть сканер QR';
    }

    telegram.hapticError();
  } finally {
    setActionPending('scan', false);
  }
}

function addManual(type: CouponType = 'text') {
  editingCoupon.value = null;
  scannedQrText.value = '';
  formInitialType.value = type;
  formInitialGroupId.value = activeGroupId.value === 'all' ? null : activeGroupId.value;
  couponFormOpen.value = true;
}

function editCoupon(coupon: Coupon) {
  editingCoupon.value = coupon;
  scannedQrText.value = '';
  formInitialGroupId.value = coupon.group_id;
  formInitialType.value = coupon.type;
  couponFormOpen.value = true;
}

function openCoupon(coupon: Coupon) {
  selectedCoupon.value = coupon;
  couponViewerOpen.value = true;
}

async function saveCoupon(payload: CreateCouponPayload) {
  await runLockedAction('coupon:save', async () => {
    if (editingCoupon.value) {
      await store.updateCoupon(editingCoupon.value.id, payload);
      showSuccess('Купон обновлён');
    } else {
      const created = await store.createCoupon(payload);
      selectedCoupon.value = created;
      showSuccess('Купон сохранён');
    }

    couponFormOpen.value = false;
    editingCoupon.value = null;
    scannedQrText.value = '';
  });
}

function openTextModal(mode: TextModalMode, group: CouponGroup | null = null) {
  textModalMode.value = mode;
  textModalGroup.value = group;
  textModalOpen.value = true;
}

async function submitTextModal(rawValue: string) {
  const value = textModalMode.value === 'join-code' ? rawValue.trim().toUpperCase() : rawValue.trim();
  if (!value) return;

  const mode = textModalMode.value;

  await runLockedAction(`text-modal:${mode}`, async () => {
    if (mode === 'create-group') {
      const group = await store.createGroup(value);
      activeGroupId.value = group.id;
      showSuccess('Группа создана');
    }

    if (mode === 'rename-group' && textModalGroup.value) {
      await store.renameGroup(textModalGroup.value.id, value);
      showSuccess('Группа переименована');
    }

    if (mode === 'create-space') {
      await store.createSharedSpace(value);
      activeGroupId.value = 'all';
      showSuccess('Общая коллекция создана');
    }

    if (mode === 'join-code') {
      await store.acceptInvite(value);
      activeGroupId.value = 'all';
      showSuccess('Вы добавлены в общую коллекцию');
    }

    textModalOpen.value = false;
  });
}

function createGroup() {
  openTextModal('create-group');
}

function renameGroup(group: CouponGroup) {
  openTextModal('rename-group', group);
}

async function deleteGroup(group: CouponGroup) {
  if (!window.confirm(`Удалить группу “${group.title}”? Купоны перейдут в “Без группы”.`)) return;

  await runLockedAction(`group:delete:${group.id}`, async () => {
    await store.deleteGroup(group.id);
    if (activeGroupId.value === group.id) activeGroupId.value = 'all';
  }, 'Группа удалена');
}

function createSharedSpace() {
  openTextModal('create-space');
}

function joinByCode() {
  openTextModal('join-code');
}

async function openInviteModal() {
  invite.value = null;
  inviteModalOpen.value = true;
}

async function createInvite() {
  await runLockedAction('invite:create', async () => {
    invite.value = await store.createInvite();
  }, 'Код приглашения создан');
}

async function toggleFavorite(coupon: Coupon) {
  await runLockedAction(`coupon:favorite:${coupon.id}`, async () => {
    await store.updateCoupon(coupon.id, { is_favorite: !coupon.is_favorite });
  });
}

async function toggleArchive(coupon: Coupon, archived: boolean) {
  const actionKey = archived ? `coupon:archive:${coupon.id}` : `coupon:restore:${coupon.id}`;

  await runLockedAction(actionKey, async () => {
    await store.updateCoupon(coupon.id, { is_archived: archived });
  }, archived ? 'Купон в архиве' : 'Купон восстановлен');
}

async function deleteCoupon(coupon: Coupon) {
  if (!window.confirm(`Удалить купон “${coupon.title}”?`)) return;

  await runLockedAction(`coupon:delete:${coupon.id}`, async () => {
    await store.deleteCoupon(coupon.id);
  }, 'Купон удалён');
}

watch(showArchived, async (value) => {
  await runLockedAction('coupons:archive-filter', async () => {
    await store.fetchCoupons({ archived: value });
  });
});

provide(walletUiKey, {
  store,
  activeGroupId,
  search,
  showArchived,
  activeTab,
  activeTabLabel,
  currentUserName,
  profileInitial,
  pendingSpaceId,
  isScanning,
  isCouponSaving,
  isTextModalSubmitting,
  textModalMode,
  isInviteCreating,
  isArchiveFilterLoading,
  activeSpaceBadge,
  visibleGroupsPreview,
  visibleCouponsBase,
  groupsWithCounts,
  ungroupedCount,
  filteredCoupons,
  favoriteCount,
  archivedCount,
  qrCouponsCount,
  textCouponsCount,
  activeGroupTitle,
  workspaceSubtitle,
  setTab,
  memberDisplayName,
  toggleArchivedFilter,
  getCouponGroup,
  getCouponPendingAction,
  getGroupPendingAction,
  syncNow,
  selectSpace,
  scanCoupon,
  addManual,
  editCoupon,
  openCoupon,
  createGroup,
  renameGroup,
  deleteGroup,
  createSharedSpace,
  joinByCode,
  openInviteModal,
  toggleFavorite,
  toggleArchive,
  deleteCoupon,
});

onMounted(async () => {
  telegram.init();
  await safeAction(async () => {
    await store.init();
  });
});
</script>

<template>
  <main class="app-shell" data-scroll-lock-root>
    <div class="app-layout app-layout--with-nav">
      <header class="topbar topbar--product">
        <button class="brand-block brand-block--button" type="button" @click="setTab('home')">
          <div class="brand-logo">QR</div>
          <div>
            <p class="eyebrow">{{ activeTabLabel }}</p>
            <h1>QR Купоны</h1>
          </div>
        </button>

        <button class="user-chip user-chip--button" type="button" @click="setTab('profile')">
          <span>{{ profileInitial }}</span>
          <strong>{{ currentUserName }}</strong>
        </button>
      </header>

      <section v-if="store.isOffline || store.pendingSyncCount > 0 || store.isSyncing || store.syncError" class="sync-banner" :class="{ 'sync-banner--offline': store.isOffline || store.syncError, 'sync-banner--syncing': store.isSyncing }">
        <div class="sync-banner__icon" aria-hidden="true">
          <LoadingSpinner v-if="store.isSyncing" />
          <svg v-else-if="store.isOffline" viewBox="0 0 24 24">
            <path d="M2 8.5A15 15 0 0 1 22 8.5" />
            <path d="M5.5 12a10 10 0 0 1 13 0" />
            <path d="M9 15.5a5 5 0 0 1 6 0" />
            <path d="M4 4 20 20" />
          </svg>
          <svg v-else viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 0 1-15.5 6.2" />
            <path d="M3 12A9 9 0 0 1 18.5 5.8" />
            <path d="M21 4v6h-6" />
            <path d="M3 20v-6h6" />
          </svg>
        </div>
        <div>
          <strong>{{ syncStatusTitle }}</strong>
          <small>{{ syncStatusText }}</small>
        </div>
        <button v-if="!store.isOffline && store.pendingSyncCount > 0" class="sync-banner__button" type="button" :disabled="store.isSyncing" @click="syncNow">
          {{ store.isSyncing ? '...' : 'Синхр.' }}
        </button>
      </section>

      <div v-if="store.isLoading" class="loader-card">
        <div class="loader-pulse"></div>
        <strong>Загружаю кошелёк</strong>
        <p>Подтягиваю коллекции, группы и купоны.</p>
      </div>

      <RouterView v-else />
    </div>

    <nav class="bottom-nav" aria-label="Главная навигация">
      <button class="bottom-nav__item" :class="{ 'bottom-nav__item--active': activeTab === 'home' }" type="button" @click="setTab('home')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.25a2.25 2.25 0 0 0 0 4.5v1.25A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-1.25a2.25 2.25 0 0 0 0-4.5z" />
          <path d="m9 15 6-6" />
        </svg>
        <span>Промо</span>
      </button>
      <button class="bottom-nav__item" :class="{ 'bottom-nav__item--active': activeTab === 'groups' }" type="button" @click="setTab('groups')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M8 12h8" />
        </svg>
        <span>Группы</span>
      </button>
      <button class="bottom-nav__item" :class="{ 'bottom-nav__item--active': activeTab === 'profile' }" type="button" @click="setTab('profile')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>Профиль</span>
      </button>
    </nav>

    <button v-if="activeTab === 'home'" class="floating-scan-button" type="button" aria-label="Сканировать QR" :disabled="isScanning" @click="scanCoupon">
      <LoadingSpinner v-if="isScanning" />
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.3" />
        <rect x="14" y="4" width="6" height="6" rx="1.3" />
        <rect x="4" y="14" width="6" height="6" rx="1.3" />
        <path d="M14 14h2.5v2.5H14z" />
        <path d="M18 14h2v6h-6v-2h4z" />
      </svg>
    </button>

    <CouponFormModal
      v-model="couponFormOpen"
      :groups="store.groups"
      :initial-coupon="editingCoupon"
      :initial-qr-text="scannedQrText"
      :initial-group-id="formInitialGroupId"
      :initial-type="formInitialType"
      :is-saving="isCouponSaving"
      @save="saveCoupon"
    />

    <QrCodeViewer v-model="couponViewerOpen" :coupon="selectedCoupon" />

    <InviteModal v-model="inviteModalOpen" :invite="invite" :is-creating="isInviteCreating" @create="createInvite" />

    <TextInputModal
      v-model="textModalOpen"
      :title="textModalConfig.title"
      :subtitle="textModalConfig.subtitle"
      :label="textModalConfig.label"
      :placeholder="textModalConfig.placeholder"
      :initial-value="textModalConfig.initialValue"
      :confirm-text="textModalConfig.confirmText"
      :is-submitting="isTextModalSubmitting"
      @submit="submitTextModal"
    />

    <AppToastStack
      :success-message="successMessage"
      :error-message="store.error"
      @close-success="successMessage = null"
      @close-error="store.clearError()"
    />
  </main>
</template>
