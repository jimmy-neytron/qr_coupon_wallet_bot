<script setup lang="ts">
import { reactive, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import LoadingSpinner from './LoadingSpinner.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    subtitle?: string;
    label: string;
    placeholder?: string;
    initialValue?: string;
    confirmText?: string;
    maxLength?: number;
    inputMode?: 'text' | 'search' | 'email' | 'tel' | 'url' | 'none' | 'numeric' | 'decimal';
    isSubmitting?: boolean;
  }>(),
  {
    placeholder: '',
    initialValue: '',
    confirmText: 'Сохранить',
    maxLength: 120,
    inputMode: 'text',
    isSubmitting: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [value: string];
}>();

const form = reactive({
  value: '',
});

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) form.value = props.initialValue ?? '';
  },
);

function close() {
  if (props.isSubmitting) return;
  emit('update:modelValue', false);
}

function submit() {
  if (props.isSubmitting) return;

  const value = form.value.trim();
  if (!value) return;
  emit('submit', value);
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :subtitle="subtitle"
    :is-busy="isSubmitting"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="form text-input-modal" @submit.prevent="submit">
      <label class="field">
        <span>{{ label }}</span>
        <input
          v-model="form.value"
          :maxlength="maxLength"
          :placeholder="placeholder"
          :inputmode="inputMode"
          :disabled="isSubmitting"
          type="text"
          autocomplete="off"
          required
        />
      </label>

      <div class="modal-actions-row">
        <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="close">Отмена</button>
        <button class="button button--primary" type="submit" :disabled="isSubmitting || !form.value.trim()">
          <LoadingSpinner v-if="isSubmitting" />
          <span>{{ isSubmitting ? 'Выполняю...' : confirmText }}</span>
        </button>
      </div>
    </form>
  </BaseModal>
</template>
