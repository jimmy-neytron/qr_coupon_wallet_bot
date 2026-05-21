<script setup lang="ts">
export type NavigationTab = 'home' | 'groups' | 'profile';

defineProps<{
  activeTab: NavigationTab;
}>();

const emit = defineEmits<{
  navigate: [tab: NavigationTab];
}>();

const items: Array<{ tab: NavigationTab; label: string; icon: 'ticket' | 'folder' | 'profile' }> = [
  { tab: 'home', label: 'Промо', icon: 'ticket' },
  { tab: 'groups', label: 'Группы', icon: 'folder' },
  { tab: 'profile', label: 'Профиль', icon: 'profile' },
];
</script>

<template>
  <nav class="bottom-nav" aria-label="Главная навигация">
    <button
      v-for="item in items"
      :key="item.tab"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--active': activeTab === item.tab }"
      type="button"
      @click="emit('navigate', item.tab)"
    >
      <svg v-if="item.icon === 'ticket'" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.25a2.25 2.25 0 0 0 0 4.5v1.25A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-1.25a2.25 2.25 0 0 0 0-4.5z" />
        <path d="m9 15 6-6" />
      </svg>
      <svg v-else-if="item.icon === 'folder'" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M8 12h8" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
