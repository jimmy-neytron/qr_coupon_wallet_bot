<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import QRCode from 'qrcode';
import BaseModal from './BaseModal.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import type { Coupon } from '../types/domain';
import { formatDate } from '../utils/date';

const props = defineProps<{
  modelValue: boolean;
  coupon: Coupon | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const copyState = ref<'idle' | 'copying' | 'done' | 'error'>('idle');
const renderError = ref<string | null>(null);

async function renderQrCode() {
  renderError.value = null;

  if (!props.modelValue || !props.coupon || props.coupon.type !== 'qr') return;

  await nextTick();

  if (!canvasRef.value) return;

  try {
    await QRCode.toCanvas(canvasRef.value, props.coupon.qr_text, {
      width: 272,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    renderError.value = err instanceof Error ? err.message : 'Не удалось сгенерировать QR';
  }
}

async function copyValue() {
  if (!props.coupon || copyState.value === 'copying') return;

  try {
    copyState.value = 'copying';
    await navigator.clipboard.writeText(props.coupon.qr_text);
    copyState.value = 'done';
    window.setTimeout(() => (copyState.value = 'idle'), 1600);
  } catch {
    copyState.value = 'error';
    window.setTimeout(() => (copyState.value = 'idle'), 1600);
  }
}

watch(() => [props.modelValue, props.coupon?.id, props.coupon?.qr_text], renderQrCode, { immediate: true });
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="coupon?.title ?? 'Купон'"
    :subtitle="coupon?.expires_at ? `Действует до ${formatDate(coupon.expires_at)}` : undefined"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="coupon" class="qr-viewer">
      <div v-if="coupon.type === 'qr'" class="qr-box">
        <canvas ref="canvasRef" aria-label="QR-код" />
        <p v-if="renderError" class="danger">{{ renderError }}</p>
      </div>

      <div v-else class="promo-text-box">
        {{ coupon.qr_text }}
      </div>

      <div class="raw-value">
        <span>Содержимое</span>
        <code>{{ coupon.qr_text }}</code>
      </div>

      <p v-if="coupon.note" class="note">{{ coupon.note }}</p>

      <button class="button button--primary" type="button" :disabled="copyState === 'copying'" @click="copyValue">
        <LoadingSpinner v-if="copyState === 'copying'" />
        <span>{{ copyState === 'done' ? 'Скопировано' : copyState === 'error' ? 'Не удалось скопировать' : copyState === 'copying' ? 'Копирую...' : 'Скопировать строку' }}</span>
      </button>
    </div>
  </BaseModal>
</template>
