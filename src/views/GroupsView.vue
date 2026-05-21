<script setup lang="ts">
import GroupCard from '../components/GroupCard.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import { useWalletUi } from '../composables/walletUi';

const {
  activeGroupId,
  activeGroupTitle,
  visibleCouponsBase,
  groupsWithCounts,
  ungroupedCount,
  isTextModalSubmitting,
  textModalMode,
  createGroup,
  setTab,
  getGroupPendingAction,
  renameGroup,
  deleteGroup,
} = useWalletUi<any>();
</script>

<template>
  <section class="screen screen--groups">
    <section class="profile-hero groups-hero">
      <div>
        <p class="eyebrow">Категории промокодов</p>
        <h2>Наведи порядок в скидках</h2>
        <p>Создавай группы для магазинов: «Магнит», «Золотое яблоко», «Аптеки» или любые свои категории.</p>
      </div>
      <button class="button button--primary" type="button" :disabled="isTextModalSubmitting" @click="createGroup">
        <LoadingSpinner v-if="isTextModalSubmitting && textModalMode === 'create-group'" />
        <span>+ Создать группу</span>
      </button>
    </section>

    <section class="section groups-section groups-section--product">
      <div class="section-title">
        <div>
          <span>Группы</span>
          <small>Выбрано: {{ activeGroupTitle }}</small>
        </div>
        <button class="text-button" type="button" @click="activeGroupId = 'all'; setTab('home')">Все промокоды</button>
      </div>

      <div class="groups-grid">
        <article class="group-card group-card--system" :class="{ 'group-card--active': activeGroupId === 'all' }" @click="activeGroupId = 'all'; setTab('home')">
          <div class="group-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="4" width="6" height="6" rx="1.5" />
              <rect x="14" y="4" width="6" height="6" rx="1.5" />
              <rect x="4" y="14" width="6" height="6" rx="1.5" />
              <rect x="14" y="14" width="6" height="6" rx="1.5" />
            </svg>
          </div>
          <div>
            <h3>Все промокоды</h3>
            <p>{{ visibleCouponsBase.length }} позиций</p>
          </div>
        </article>

        <GroupCard
          :group="null"
          title="Без группы"
          :count="ungroupedCount"
          :active="activeGroupId === null"
          @select="activeGroupId = null; setTab('home')"
        />

        <GroupCard
          v-for="group in groupsWithCounts"
          :key="group.id"
          :group="group"
          :title="group.title"
          :count="group.coupons_count ?? 0"
          :active="activeGroupId === group.id"
          :pending-action="getGroupPendingAction(group)"
          @select="activeGroupId = group.id; setTab('home')"
          @rename="renameGroup(group)"
          @remove="deleteGroup(group)"
        />
      </div>
    </section>
  </section>
</template>
