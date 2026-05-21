<script setup lang="ts">
import CouponCard from '../components/CouponCard.vue';
import EmptyState from '../components/EmptyState.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import { useWalletUi } from '../composables/walletUi';

const {
  store,
  activeGroupId,
  search,
  showArchived,
  activeSpaceBadge,
  visibleGroupsPreview,
  visibleCouponsBase,
  filteredCoupons,
  favoriteCount,
  archivedCount,
  qrCouponsCount,
  textCouponsCount,
  activeGroupTitle,
  ungroupedCount,
  isScanning,
  isArchiveFilterLoading,
  setTab,
  scanCoupon,
  addManual,
  toggleArchivedFilter,
  getCouponGroup,
  getCouponPendingAction,
  openCoupon,
  editCoupon,
  toggleFavorite,
  toggleArchive,
  deleteCoupon,
} = useWalletUi<any>();
</script>

<template>
  <section class="screen screen--home">
    <section class="promo-hero">
      <div class="promo-hero__main">
        <button class="collection-chip" type="button" @click="setTab('profile')">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
              <path d="M8 9h8" />
              <path d="M8 13h5" />
            </svg>
          </span>
          {{ activeSpaceBadge }}
        </button>

        <h2>Все промокоды под рукой</h2>
        <p>Сканируй QR, добавляй текстовые промокоды и быстро открывай нужную скидку прямо на кассе.</p>
      </div>

      <div class="promo-hero__actions">
        <button class="button button--primary button--xl" type="button" :disabled="isScanning" @click="scanCoupon">
          <LoadingSpinner v-if="isScanning" />
          <span v-else class="button-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="4" width="6" height="6" rx="1.3" />
              <rect x="14" y="4" width="6" height="6" rx="1.3" />
              <rect x="4" y="14" width="6" height="6" rx="1.3" />
              <path d="M14 14h2.5v2.5H14z" />
              <path d="M18 14h2v6h-6v-2h4z" />
            </svg>
          </span>
          <span>{{ isScanning ? 'Открываю сканер...' : 'Сканировать QR' }}</span>
        </button>
        <button class="button button--soft button--xl" type="button" @click="addManual('text')">+ Промокод</button>
      </div>
    </section>

    <section class="promo-dashboard" aria-label="Статистика промокодов">
      <article class="promo-metric promo-metric--primary">
        <span>Активные</span>
        <strong>{{ store.activeCoupons.length }}</strong>
      </article>
      <article class="promo-metric">
        <span>Избранное</span>
        <strong>{{ favoriteCount }}</strong>
      </article>
      <article class="promo-metric">
        <span>QR</span>
        <strong>{{ qrCouponsCount }}</strong>
      </article>
      <article class="promo-metric">
        <span>Текстовые</span>
        <strong>{{ textCouponsCount }}</strong>
      </article>
    </section>

    <section class="promo-toolbar">
      <label class="search-field search-field--large search-field--icon">
        <span>Поиск</span>
        <input v-model="search" type="search" placeholder="Магнит, SALE500, заметка..." />
      </label>

      <button class="archive-toggle" type="button" :disabled="isArchiveFilterLoading" @click="toggleArchivedFilter">
        <LoadingSpinner v-if="isArchiveFilterLoading" />
        <span>{{ showArchived ? 'Активные' : 'Архив' }}</span>
        <strong>{{ showArchived ? store.activeCoupons.length : archivedCount }}</strong>
      </button>
    </section>

    <section class="group-filter-card">
      <div class="section-title section-title--compact">
        <div>
          <span>Быстрый фильтр</span>
          <small>{{ activeGroupTitle }}</small>
        </div>
        <button class="text-button" type="button" @click="setTab('groups')">Управлять</button>
      </div>

      <div class="filter-chips" aria-label="Фильтр по группам">
        <button class="filter-chip" :class="{ 'filter-chip--active': activeGroupId === 'all' }" type="button" @click="activeGroupId = 'all'">
          Все <strong>{{ visibleCouponsBase.length }}</strong>
        </button>
        <button class="filter-chip" :class="{ 'filter-chip--active': activeGroupId === null }" type="button" @click="activeGroupId = null">
          Без группы <strong>{{ ungroupedCount }}</strong>
        </button>
        <button
          v-for="group in visibleGroupsPreview"
          :key="group.id"
          class="filter-chip"
          :class="{ 'filter-chip--active': activeGroupId === group.id }"
          type="button"
          @click="activeGroupId = group.id"
        >
          {{ group.title }} <strong>{{ group.coupons_count ?? 0 }}</strong>
        </button>
      </div>
    </section>

    <section class="section coupons-section coupons-section--flat">
      <div class="section-title section-title--sticky">
        <div>
          <span>{{ showArchived ? 'Архив' : activeGroupTitle }}</span>
          <small>{{ filteredCoupons.length }} {{ filteredCoupons.length === 1 ? 'позиция' : 'позиций' }}</small>
        </div>
        <button class="text-button" type="button" @click="addManual('text')">+ Добавить</button>
      </div>

      <EmptyState
        v-if="filteredCoupons.length === 0"
        title="Пока пусто"
        :text="showArchived ? 'В архиве нет промокодов.' : 'Добавь первый QR или текстовый промокод.'"
      />

      <div v-else class="coupons-list coupons-list--product">
        <CouponCard
          v-for="coupon in filteredCoupons"
          :key="coupon.id"
          :coupon="coupon"
          :group="getCouponGroup(coupon)"
          :pending-action="getCouponPendingAction(coupon)"
          @open="openCoupon(coupon)"
          @edit="editCoupon(coupon)"
          @favorite="toggleFavorite(coupon)"
          @archive="toggleArchive(coupon, true)"
          @restore="toggleArchive(coupon, false)"
          @remove="deleteCoupon(coupon)"
        />
      </div>
    </section>
  </section>
</template>
