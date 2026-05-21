<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    successMessage?: string | null;
    errorMessage?: string | null;
    successTitle?: string;
    errorTitle?: string;
    duration?: number;
  }>(),
  {
    successMessage: '',
    errorMessage: '',
    successTitle: 'Готово',
    errorTitle: 'Ошибка',
    duration: 4200,
  },
);

const emit = defineEmits<{
  'close-success': [];
  'close-error': [];
}>();

let successTimer: number | null = null;
let errorTimer: number | null = null;

/** Clears delayed success toast closing. */
function clearSuccessTimer() {
  if (successTimer) {
    window.clearTimeout(successTimer);
    successTimer = null;
  }
}

/** Clears delayed error toast closing. */
function clearErrorTimer() {
  if (errorTimer) {
    window.clearTimeout(errorTimer);
    errorTimer = null;
  }
}

function closeSuccess() {
  clearSuccessTimer();
  emit('close-success');
}

function closeError() {
  clearErrorTimer();
  emit('close-error');
}

watch(
  () => props.successMessage,
  (message) => {
    clearSuccessTimer();
    if (!message) return;

    successTimer = window.setTimeout(() => emit('close-success'), props.duration);
  },
  { immediate: true },
);

watch(
  () => props.errorMessage,
  (message) => {
    clearErrorTimer();
    if (!message) return;

    errorTimer = window.setTimeout(() => emit('close-error'), props.duration);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearSuccessTimer();
  clearErrorTimer();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="successMessage || errorMessage" class="app-toast-stack" aria-live="polite" aria-atomic="true">
      <Transition name="app-toast">
        <div v-if="successMessage" class="app-toast app-toast--success" role="status">
          <span class="app-toast__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>

          <div class="app-toast__body">
            <strong>{{ successTitle }}</strong>
            <p>{{ successMessage }}</p>
          </div>

          <button class="app-toast__close" type="button" aria-label="Закрыть уведомление" @click="closeSuccess">
            <svg viewBox="0 0 24 24">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          </button>
        </div>
      </Transition>

      <Transition name="app-toast">
        <div v-if="errorMessage" class="app-toast app-toast--error" role="alert">
          <span class="app-toast__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 8v5" />
              <path d="M12 17h.01" />
              <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>

          <div class="app-toast__body">
            <strong>{{ errorTitle }}</strong>
            <p>{{ errorMessage }}</p>
          </div>

          <button class="app-toast__close" type="button" aria-label="Закрыть уведомление" @click="closeError">
            <svg viewBox="0 0 24 24">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.app-toast-stack {
  position: fixed;
  left: 50%;
  bottom: calc(96px + var(--safe-bottom, 0px));
  z-index: 1000;
  display: grid;
  gap: 10px;
  width: min(440px, calc(100vw - 28px));
  pointer-events: none;
  transform: translateX(-50%);
}

.app-toast {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 20px 55px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(22px);
  pointer-events: auto;
}

.app-toast--success {
  border-color: color-mix(in srgb, var(--success, #16a34a) 26%, transparent);
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, var(--success, #16a34a) 16%, transparent), transparent 42%),
    rgba(255, 255, 255, 0.92);

  .app-toast__icon {
    background: linear-gradient(135deg, #22c55e, #16a34a);
  }
}

.app-toast--error {
  border-color: color-mix(in srgb, var(--danger, #ef4444) 26%, transparent);
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, var(--danger, #ef4444) 14%, transparent), transparent 42%),
    rgba(255, 255, 255, 0.92);

  .app-toast__icon {
    background: linear-gradient(135deg, #fb7185, #ef4444);
  }
}

.app-toast__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.16);

  svg {
    width: 21px;
    height: 21px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.app-toast__body {
  min-width: 0;

  strong {
    display: block;
    margin-bottom: 2px;
    color: var(--text, #0f172a);
    font-size: 13px;
    font-weight: 950;
    line-height: 1.15;
  }

  p {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--muted, #64748b);
    font-size: 13px;
    font-weight: 800;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }
}

.app-toast__close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 14px;
  color: var(--muted, #64748b);
  background: rgba(241, 245, 249, 0.86);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;

  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  &:hover {
    color: var(--text, #0f172a);
    background: rgba(226, 232, 240, 0.96);
  }

  &:active {
    transform: scale(0.94);
  }
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

@media (max-width: 760px) {
  .app-toast-stack {
    bottom: calc(88px + var(--safe-bottom, 0px));
    width: calc(100vw - 24px);
  }

  .app-toast {
    border-radius: 22px;
  }
}
</style>
