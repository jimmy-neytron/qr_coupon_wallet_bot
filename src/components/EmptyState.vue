<script setup lang="ts">
defineProps<{
  title: string;
  text: string;
}>();
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon">⌁</div>
    <h3>{{ title }}</h3>
    <p>{{ text }}</p>
  </div>
</template>
