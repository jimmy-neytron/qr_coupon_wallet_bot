<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import BaseModal from './BaseModal.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import type { Invite } from '../types/domain';

type CopyTarget = 'code' | 'link';
type CopyStatus = 'idle' | 'done' | 'error';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    invite: Invite | null;
    inviteLink?: string;
    isCreating?: boolean;
  }>(),
  {
    inviteLink: '',
    isCreating: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  create: [];
}>();

const copyingTarget = ref<CopyTarget | null>(null);
const copyStatus = ref<Record<CopyTarget, CopyStatus>>({
  code: 'idle',
  link: 'idle',
});

let resetCopyStatusTimer: number | null = null;

const isCopyingCode = computed(() => copyingTarget.value === 'code');
const isCopyingLink = computed(() => copyingTarget.value === 'link');
const canCopyLink = computed(() => Boolean(props.inviteLink.trim()) && !props.isCreating);
const linkButtonText = computed(() => getCopyButtonText('link', 'Скопировать ссылку'));

/** Returns a short status label for a concrete copy target. */
function getCopyButtonText(target: CopyTarget, idleText: string) {
  if (copyingTarget.value === target) return 'Копирую...';
  if (copyStatus.value[target] === 'done') return 'Скопировано';
  if (copyStatus.value[target] === 'error') return 'Не удалось';

  return idleText;
}

/** Resets copy status after a short delay. */
function resetCopyStatusLater(target: CopyTarget) {
  if (resetCopyStatusTimer) {
    window.clearTimeout(resetCopyStatusTimer);
  }

  resetCopyStatusTimer = window.setTimeout(() => {
    copyStatus.value = { ...copyStatus.value, [target]: 'idle' };
    resetCopyStatusTimer = null;
  }, 1600);
}

/** Copies text using Clipboard API with a textarea fallback for Telegram WebView. */
async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/** Copies invite code or invite link and shows inline status. */
async function copyValue(target: CopyTarget, value: string) {
  if (copyingTarget.value || props.isCreating || !value.trim()) return;

  copyingTarget.value = target;
  copyStatus.value = { ...copyStatus.value, [target]: 'idle' };

  try {
    await writeClipboard(value);
    copyStatus.value = { ...copyStatus.value, [target]: 'done' };
  } catch {
    copyStatus.value = { ...copyStatus.value, [target]: 'error' };
  } finally {
    copyingTarget.value = null;
    resetCopyStatusLater(target);
  }
}

onBeforeUnmount(() => {
  if (resetCopyStatusTimer) {
    window.clearTimeout(resetCopyStatusTimer);
  }
});
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Приглашение"
    subtitle="Передай код или ссылку человеку, которого хочешь добавить в общую коллекцию"
    :is-busy="isCreating"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="invite-panel">
      <template v-if="invite">
        <section class="invite-card" aria-labelledby="invite-code-title">
          <div class="invite-card__header">
            <div>
              <span id="invite-code-title" class="invite-card__label">Код приглашения</span>
              <strong class="invite-card__code">{{ invite.code }}</strong>
            </div>

            <button
              class="invite-copy-button"
              type="button"
              :aria-label="getCopyButtonText('code', 'Скопировать код')"
              :title="getCopyButtonText('code', 'Скопировать код')"
              :disabled="Boolean(copyingTarget) || isCreating"
              @click="copyValue('code', invite.code)"
            >
              <LoadingSpinner v-if="isCopyingCode" />
              <svg v-else-if="copyStatus.code === 'done'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          <p v-if="copyStatus.code !== 'idle'" class="invite-card__status" :class="`invite-card__status--${copyStatus.code}`">
            {{ getCopyButtonText('code', 'Скопировать код') }}
          </p>
        </section>

        <section class="invite-link-card" aria-labelledby="invite-link-title">
          <div>
            <span id="invite-link-title" class="invite-card__label">Ссылка приглашения</span>
            <p class="invite-link-card__text">
              По ссылке человек откроет Telegram Mini App и автоматически войдёт в эту коллекцию.
            </p>
          </div>

          <code class="invite-link-card__url">
            {{ inviteLink || 'Укажи VITE_TELEGRAM_BOT_USERNAME и VITE_TELEGRAM_APP_NAME, чтобы получить ссылку на Mini App' }}
          </code>

          <button
            class="button button--primary"
            type="button"
            :disabled="Boolean(copyingTarget) || !canCopyLink"
            @click="copyValue('link', inviteLink)"
          >
            <LoadingSpinner v-if="isCopyingLink" />
            <span>{{ linkButtonText }}</span>
          </button>
        </section>
      </template>

      <template v-else>
        <section class="invite-empty-state">
          <div class="invite-empty-state__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6" />
              <path d="M22 11h-6" />
            </svg>
          </div>

          <div>
            <h3>Код ещё не создан</h3>
            <p>Создай приглашение, чтобы поделиться общей коллекцией.</p>
          </div>
        </section>

        <button class="button button--primary" type="button" :disabled="isCreating" @click="emit('create')">
          <LoadingSpinner v-if="isCreating" />
          <span>{{ isCreating ? 'Создаю...' : 'Создать код' }}</span>
        </button>
      </template>
    </div>
  </BaseModal>
</template>

<style scoped lang="scss">
.invite-panel {
  display: grid;
  gap: 14px;
}

.invite-card,
.invite-link-card,
.invite-empty-state {
  border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: 24px;
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, var(--accent) 14%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface-strong) 94%, transparent);
  box-shadow: var(--shadow-sm);
}

.invite-card {
  display: grid;
  gap: 8px;
  padding: 16px;
}

.invite-card__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.invite-card__label {
  display: block;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.invite-card__code {
  display: block;
  overflow-wrap: anywhere;
  color: var(--accent);
  font-size: clamp(30px, 12vw, 44px);
  font-weight: 950;
  letter-spacing: 0.08em;
  line-height: 1;
}

.invite-copy-button {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 18px;
  color: var(--accent-text);
  background: var(--accent);
  box-shadow: 0 14px 30px color-mix(in srgb, var(--accent) 24%, transparent);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;

  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:active:not(:disabled) {
    transform: scale(0.94);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }
}

.invite-card__status {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;

  &--done {
    color: var(--success);
  }

  &--error {
    color: var(--danger);
  }
}

.invite-link-card {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.invite-link-card__text {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.4;
}

.invite-link-card__url {
  display: block;
  overflow-wrap: anywhere;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text);
  background: color-mix(in srgb, var(--muted) 8%, transparent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
}

.invite-empty-state {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
  text-align: left;

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 17px;
    font-weight: 950;
  }

  p {
    margin-top: 4px;
    color: var(--muted);
    font-weight: 750;
    line-height: 1.4;
  }
}

.invite-empty-state__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 18px;
  color: var(--accent);
  background: var(--accent-soft);

  svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
</style>
