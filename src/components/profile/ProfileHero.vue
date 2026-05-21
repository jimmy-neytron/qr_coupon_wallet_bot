<script setup lang="ts">
defineProps<{
  initial: string;
  name: string;
}>();
</script>

<template>
  <section class="profile-hero">
    <div class="profile-avatar">{{ initial }}</div>
    <div class="profile-hero__content">
      <p class="eyebrow">Профиль</p>
      <h2>{{ name }}</h2>
      <p>Управляй коллекциями отдельно от промокодов: выбирай активную, подключайся по коду и приглашай участников.</p>
    </div>
  </section>
</template>
