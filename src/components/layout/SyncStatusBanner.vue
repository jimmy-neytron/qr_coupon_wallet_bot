<script setup lang="ts">
import LoadingSpinner from '../LoadingSpinner.vue';

defineProps<{
  visible: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  title: string;
  text: string;
}>();

const emit = defineEmits<{
  sync: [];
}>();
</script>

<template>
  <section
    v-if="visible"
    class="sync-banner"
    :class="{ 'sync-banner--offline': isOffline, 'sync-banner--syncing': isSyncing }"
  >
    <div class="sync-banner__icon" aria-hidden="true">
      <LoadingSpinner v-if="isSyncing" />
      <svg v-else-if="isOffline" viewBox="0 0 24 24">
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
      <strong>{{ title }}</strong>
      <small>{{ text }}</small>
    </div>

    <button
      v-if="!isOffline && pendingSyncCount > 0"
      class="sync-banner__button"
      type="button"
      :disabled="isSyncing"
      @click="emit('sync')"
    >
      {{ isSyncing ? '...' : 'Синхр.' }}
    </button>
  </section>
</template>
