<script setup lang="ts">
defineProps<{
  activeCount: number;
  favoriteCount: number;
  qrCount: number;
  textCount: number;
}>();
</script>

<template>
  <section class="promo-dashboard" aria-label="Статистика промокодов">
    <article class="promo-metric promo-metric--primary">
      <span>Активные</span>
      <strong>{{ activeCount }}</strong>
    </article>
    <article class="promo-metric">
      <span>Избранное</span>
      <strong>{{ favoriteCount }}</strong>
    </article>
    <article class="promo-metric">
      <span>QR</span>
      <strong>{{ qrCount }}</strong>
    </article>
    <article class="promo-metric">
      <span>Текстовые</span>
      <strong>{{ textCount }}</strong>
    </article>
  </section>
</template>
