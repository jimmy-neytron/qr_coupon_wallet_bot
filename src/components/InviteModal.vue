<script setup lang="ts">
import { ref } from 'vue';
import BaseModal from './BaseModal.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import type { Invite } from '../types/domain';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    invite: Invite | null;
    isCreating?: boolean;
  }>(),
  {
    isCreating: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  create: [];
}>();

const isCopying = ref(false);
const copyStatus = ref<'idle' | 'done' | 'error'>('idle');

async function copyCode(code: string) {
  if (isCopying.value || props.isCreating) return;

  isCopying.value = true;
  copyStatus.value = 'idle';

  try {
    await navigator.clipboard.writeText(code);
    copyStatus.value = 'done';
  } catch {
    copyStatus.value = 'error';
  } finally {
    isCopying.value = false;
    window.setTimeout(() => (copyStatus.value = 'idle'), 1600);
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Приглашение"
    subtitle="Передай код человеку, которого хочешь добавить в общую коллекцию"
    :is-busy="isCreating"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="invite-box">
      <template v-if="invite">
        <span>Код приглашения</span>
        <strong>{{ invite.code }}</strong>
        <button class="button button--primary" type="button" :disabled="isCopying || isCreating" @click="copyCode(invite.code)">
          <LoadingSpinner v-if="isCopying" />
          <span>{{ copyStatus === 'done' ? 'Скопировано' : copyStatus === 'error' ? 'Не удалось' : isCopying ? 'Копирую...' : 'Скопировать код' }}</span>
        </button>
      </template>

      <template v-else>
        <p>Код ещё не создан.</p>
        <button class="button button--primary" type="button" :disabled="isCreating" @click="emit('create')">
          <LoadingSpinner v-if="isCreating" />
          <span>{{ isCreating ? 'Создаю...' : 'Создать код' }}</span>
        </button>
      </template>
    </div>
  </BaseModal>
</template>
