<script setup lang="ts">
import type { CouponGroup } from '../../types/domain';
import GroupCard from '../GroupCard.vue';

type GroupFilter = string | null | 'all';

defineProps<{
  activeGroupId: GroupFilter;
  activeGroupTitle: string;
  allCount: number;
  ungroupedCount: number;
  groups: Array<CouponGroup & { coupons_count?: number }>;
  getPendingAction: (group: CouponGroup) => 'remove' | null;
}>();

const emit = defineEmits<{
  select: [value: GroupFilter];
  rename: [group: CouponGroup];
  remove: [group: CouponGroup];
}>();
</script>

<template>
  <section class="section groups-section groups-section--product">
    <div class="section-title">
      <div>
        <span>Группы</span>
        <small>Выбрано: {{ activeGroupTitle }}</small>
      </div>
      <button class="text-button" type="button" @click="emit('select', 'all')">Все промокоды</button>
    </div>

    <div class="groups-grid">
      <article class="group-card group-card--system" :class="{ 'group-card--active': activeGroupId === 'all' }" @click="emit('select', 'all')">
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
          <p>{{ allCount }} позиций</p>
        </div>
      </article>

      <GroupCard
        :group="null"
        title="Без группы"
        :count="ungroupedCount"
        :active="activeGroupId === null"
        @select="emit('select', null)"
      />

      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        :title="group.title"
        :count="group.coupons_count ?? 0"
        :active="activeGroupId === group.id"
        :pending-action="getPendingAction(group)"
        @select="emit('select', group.id)"
        @rename="emit('rename', group)"
        @remove="emit('remove', group)"
      />
    </div>
  </section>
</template>
