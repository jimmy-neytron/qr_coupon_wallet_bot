<script setup lang="ts">
import type { CouponGroup } from '../../types/domain';

type GroupFilter = string | null | 'all';

defineProps<{
  modelValue: GroupFilter;
  activeGroupTitle: string;
  groups: Array<CouponGroup & { coupons_count?: number }>;
  allCount: number;
  ungroupedCount: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: GroupFilter];
  manage: [];
}>();
</script>

<template>
  <section class="group-filter-card">
    <div class="section-title section-title--compact">
      <div>
        <span>Быстрый фильтр</span>
        <small>{{ activeGroupTitle }}</small>
      </div>
      <button class="text-button" type="button" @click="emit('manage')">Управлять</button>
    </div>

    <div class="filter-chips" aria-label="Фильтр по группам">
      <button class="filter-chip" :class="{ 'filter-chip--active': modelValue === 'all' }" type="button" @click="emit('update:modelValue', 'all')">
        Все <strong>{{ allCount }}</strong>
      </button>
      <button class="filter-chip" :class="{ 'filter-chip--active': modelValue === null }" type="button" @click="emit('update:modelValue', null)">
        Без группы <strong>{{ ungroupedCount }}</strong>
      </button>
      <button
        v-for="group in groups"
        :key="group.id"
        class="filter-chip"
        :class="{ 'filter-chip--active': modelValue === group.id }"
        type="button"
        @click="emit('update:modelValue', group.id)"
      >
        {{ group.title }} <strong>{{ group.coupons_count ?? 0 }}</strong>
      </button>
    </div>
  </section>
</template>
