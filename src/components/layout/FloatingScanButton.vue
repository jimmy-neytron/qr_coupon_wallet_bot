<script setup lang="ts">
import LoadingSpinner from '../LoadingSpinner.vue';

defineProps<{
  visible: boolean;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  scan: [];
}>();
</script>

<template>
  <button
    v-if="visible"
    class="floating-scan-button"
    type="button"
    aria-label="Сканировать QR"
    :disabled="isLoading"
    @click="emit('scan')"
  >
    <LoadingSpinner v-if="isLoading" />
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.3" />
      <rect x="14" y="4" width="6" height="6" rx="1.3" />
      <rect x="4" y="14" width="6" height="6" rx="1.3" />
      <path d="M14 14h2.5v2.5H14z" />
      <path d="M18 14h2v6h-6v-2h4z" />
    </svg>
  </button>
</template>
