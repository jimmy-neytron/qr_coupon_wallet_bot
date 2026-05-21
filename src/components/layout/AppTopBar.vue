<script setup lang="ts">
defineProps<{
  activeTabLabel: string;
  profileInitial: string;
  currentUserName: string;
}>();

const emit = defineEmits<{
  navigate: [tab: 'home' | 'profile'];
}>();
</script>

<template>
  <header class="topbar topbar--product">
    <button class="brand-block brand-block--button" type="button" @click="emit('navigate', 'home')">
      <div class="brand-logo">QR</div>
      <div>
        <p class="eyebrow">{{ activeTabLabel }}</p>
        <h1>QR Купоны</h1>
      </div>
    </button>

    <button class="user-chip user-chip--button" type="button" @click="emit('navigate', 'profile')">
      <span>{{ profileInitial }}</span>
      <strong>{{ currentUserName }}</strong>
    </button>
  </header>
</template>
