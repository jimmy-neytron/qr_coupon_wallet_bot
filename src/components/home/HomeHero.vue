<script setup lang="ts">
import type { CouponType } from '../../types/domain';
import LoadingSpinner from '../LoadingSpinner.vue';

defineProps<{
  activeSpaceBadge: string;
  isScanning: boolean;
}>();

const emit = defineEmits<{
  profile: [];
  scan: [];
  addManual: [type: CouponType];
}>();
</script>

<template>
  <section class="promo-hero">
    <div class="promo-hero__main">
      <button class="collection-chip" type="button" @click="emit('profile')">
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
      <button class="button button--primary button--xl" type="button" :disabled="isScanning" @click="emit('scan')">
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
      <button class="button button--soft button--xl" type="button" @click="emit('addManual', 'text')">+ Промокод</button>
    </div>
  </section>
</template>
