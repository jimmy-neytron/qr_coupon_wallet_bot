<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';
import type { CouponGroup } from '../types/domain';

const props = withDefaults(
  defineProps<{
    group: CouponGroup | null;
    title: string;
    count: number;
    active: boolean;
    pendingAction?: 'remove' | null;
  }>(),
  {
    pendingAction: null,
  },
);

const emit = defineEmits<{
  select: [];
  rename: [];
  remove: [];
}>();

function getInitial(title: string) {
  return title.trim().slice(0, 1).toUpperCase() || '•';
}

function select() {
  if (props.pendingAction) return;
  emit('select');
}
</script>

<template>
  <article class="group-card" :class="{ 'group-card--active': active, 'group-card--pending': pendingAction }" @click="select">
    <div class="group-card__icon">{{ props.group ? getInitial(title) : '—' }}</div>

    <div class="group-card__content">
      <h3>{{ title }}</h3>
      <p>{{ count }} {{ count === 1 ? 'купон' : 'купонов' }}</p>
    </div>

    <div v-if="group" class="card-actions" @click.stop>
      <button class="small-button" type="button" :disabled="Boolean(pendingAction)" @click="emit('rename')">Изм.</button>
      <button class="small-button small-button--danger" type="button" :disabled="Boolean(pendingAction)" @click="emit('remove')">
        <LoadingSpinner v-if="pendingAction === 'remove'" />
        <span>{{ pendingAction === 'remove' ? 'Удаляю' : 'Удал.' }}</span>
      </button>
    </div>
  </article>
</template>
