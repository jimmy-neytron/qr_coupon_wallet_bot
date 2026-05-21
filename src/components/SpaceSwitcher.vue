<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';
import type { Space } from '../types/domain';

const props = withDefaults(
  defineProps<{
    spaces: Space[];
    selectedSpaceId: string | null;
    pendingSpaceId?: string | null;
  }>(),
  {
    pendingSpaceId: null,
  },
);

const emit = defineEmits<{
  select: [spaceId: string];
}>();

function selectSpace(spaceId: string) {
  if (props.pendingSpaceId || spaceId === props.selectedSpaceId) return;
  emit('select', spaceId);
}
</script>

<template>
  <section class="panel space-switcher space-switcher--collections">
    <div class="section-title">
      <div>
        <span>Мои коллекции</span>
        <small>Выбери, куда сохранять и откуда показывать промокоды</small>
      </div>
    </div>

    <div class="space-list" aria-label="Список коллекций промокодов">
      <button
        v-for="space in spaces"
        :key="space.id"
        class="space-pill"
        :class="{ 'space-pill--active': space.id === selectedSpaceId }"
        type="button"
        :disabled="Boolean(pendingSpaceId) || space.id === selectedSpaceId"
        @click="selectSpace(space.id)"
      >
        <span class="space-pill__icon" aria-hidden="true">
          <LoadingSpinner v-if="pendingSpaceId === space.id" />
          <template v-else>
            <svg v-if="space.type === 'personal'" viewBox="0 0 24 24">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <svg v-else viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </template>
        </span>
        <span class="space-pill__text">
          <strong>{{ space.title }}</strong>
          <small>{{ pendingSpaceId === space.id ? 'Переключаю...' : space.type === 'personal' ? 'Личная коллекция' : 'Общая коллекция' }}</small>
        </span>
        <span v-if="space.id === selectedSpaceId && pendingSpaceId !== space.id" class="space-pill__status">Активна</span>
      </button>
    </div>
  </section>
</template>
