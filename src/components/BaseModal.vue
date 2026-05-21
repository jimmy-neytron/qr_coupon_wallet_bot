<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    modelValue: boolean;
    isBusy?: boolean;
  }>(),
  {
    isBusy: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function close() {
  if (props.isBusy) return;
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-backdrop" @click.self="close">
        <section class="modal-card" role="dialog" aria-modal="true" data-scroll-lock-root>
          <header class="modal-header">
            <div class="modal-header__text">
              <h2>{{ title }}</h2>
              <p v-if="subtitle">{{ subtitle }}</p>
            </div>
            <button class="icon-button" type="button" aria-label="Закрыть" :disabled="isBusy" @click="close">×</button>
          </header>
          <div class="modal-content">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
