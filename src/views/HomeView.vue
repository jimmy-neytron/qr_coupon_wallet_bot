<script setup lang="ts">
import CouponListSection from '../components/home/CouponListSection.vue';
import GroupFilterPanel from '../components/home/GroupFilterPanel.vue';
import HomeHero from '../components/home/HomeHero.vue';
import PromoMetrics from '../components/home/PromoMetrics.vue';
import PromoToolbar from '../components/home/PromoToolbar.vue';
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
    <HomeHero
      :active-space-badge="activeSpaceBadge"
      :is-scanning="isScanning"
      @profile="setTab('profile')"
      @scan="scanCoupon"
      @add-manual="addManual"
    />

    <PromoMetrics
      :active-count="store.activeCoupons.length"
      :favorite-count="favoriteCount"
      :qr-count="qrCouponsCount"
      :text-count="textCouponsCount"
    />

    <PromoToolbar
      v-model:search="search"
      :show-archived="showArchived"
      :active-count="store.activeCoupons.length"
      :archived-count="archivedCount"
      :is-archive-filter-loading="isArchiveFilterLoading"
      @toggle-archived="toggleArchivedFilter"
    />

    <GroupFilterPanel
      v-model="activeGroupId"
      :active-group-title="activeGroupTitle"
      :groups="visibleGroupsPreview"
      :all-count="visibleCouponsBase.length"
      :ungrouped-count="ungroupedCount"
      @manage="setTab('groups')"
    />

    <CouponListSection
      :title="activeGroupTitle"
      :coupons="filteredCoupons"
      :show-archived="showArchived"
      :resolve-group="getCouponGroup"
      :resolve-pending-action="getCouponPendingAction"
      @add="addManual('text')"
      @open="openCoupon"
      @edit="editCoupon"
      @favorite="toggleFavorite"
      @archive="(coupon) => toggleArchive(coupon, true)"
      @restore="(coupon) => toggleArchive(coupon, false)"
      @remove="deleteCoupon"
    />
  </section>
</template>
