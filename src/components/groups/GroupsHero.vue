<script setup lang="ts">
import LoadingSpinner from '../LoadingSpinner.vue';

defineProps<{
  isCreating: boolean;
}>();

const emit = defineEmits<{
  create: [];
}>();
</script>

<template>
  <section class="profile-hero groups-hero">
    <div>
      <p class="eyebrow">Категории промокодов</p>
      <h2>Наведи порядок в скидках</h2>
      <p>Создавай группы для магазинов: «Магнит», «Золотое яблоко», «Аптеки» или любые свои категории.</p>
    </div>
    <button class="button button--primary" type="button" :disabled="isCreating" @click="emit('create')">
      <LoadingSpinner v-if="isCreating" />
      <span>+ Создать группу</span>
    </button>
  </section>
</template>
