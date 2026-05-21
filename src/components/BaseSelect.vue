<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export type SelectOption = {
  value: string | null;
  label: string;
  description?: string;
  icon?: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: 'Выбрать',
    disabled: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue) ?? null);

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function selectOption(value: string | null) {
  emit('update:modelValue', value);
  isOpen.value = false;
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div ref="rootRef" class="custom-select" :class="{ 'custom-select--open': isOpen, 'custom-select--disabled': disabled }">
    <button class="custom-select__trigger" type="button" :disabled="disabled" :aria-expanded="isOpen" @click="toggle">
      <span v-if="selectedOption?.icon" class="custom-select__icon">{{ selectedOption.icon }}</span>
      <span class="custom-select__value">
        <strong>{{ selectedOption?.label ?? placeholder }}</strong>
        <small v-if="selectedOption?.description">{{ selectedOption.description }}</small>
      </span>
      <svg class="custom-select__chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <Transition name="select-popover">
      <div v-if="isOpen" class="custom-select__dropdown" role="listbox">
        <button
          v-for="option in options"
          :key="String(option.value)"
          class="custom-select__option"
          :class="{ 'custom-select__option--active': option.value === modelValue }"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="selectOption(option.value)"
        >
          <span v-if="option.icon" class="custom-select__icon">{{ option.icon }}</span>
          <span class="custom-select__value">
            <strong>{{ option.label }}</strong>
            <small v-if="option.description">{{ option.description }}</small>
          </span>
          <svg v-if="option.value === modelValue" class="custom-select__check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>
