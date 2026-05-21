<script setup lang="ts">
import LoadingSpinner from '../LoadingSpinner.vue';

defineProps<{
  search: string;
  showArchived: boolean;
  activeCount: number;
  archivedCount: number;
  isArchiveFilterLoading: boolean;
}>();

const emit = defineEmits<{
  'update:search': [value: string];
  toggleArchived: [];
}>();
</script>

<template>
  <section class="promo-toolbar">
    <label class="search-field search-field--large search-field--icon">
      <span>Поиск</span>
      <input
        :value="search"
        type="search"
        placeholder="Магнит, SALE500, заметка..."
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <button class="archive-toggle" type="button" :disabled="isArchiveFilterLoading" @click="emit('toggleArchived')">
      <LoadingSpinner v-if="isArchiveFilterLoading" />
      <span>{{ showArchived ? 'Активные' : 'Архив' }}</span>
      <strong>{{ showArchived ? activeCount : archivedCount }}</strong>
    </button>
  </section>
</template>
