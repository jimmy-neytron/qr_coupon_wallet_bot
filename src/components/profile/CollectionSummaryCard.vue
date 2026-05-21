<script setup lang="ts">
import type { Space } from '../../types/domain';

defineProps<{
  space: Space;
  subtitle: string;
  couponsCount: number;
  groupsCount: number;
  membersCount: number;
}>();
</script>

<template>
  <section class="profile-space-card profile-space-card--selected">
    <div class="profile-space-card__head">
      <span class="workspace-icon" aria-hidden="true">
        <svg v-if="space.type === 'personal'" viewBox="0 0 24 24">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </span>
      <div>
        <p class="eyebrow">Сейчас открыта</p>
        <h3>{{ space.title }}</h3>
        <small>{{ subtitle }}</small>
      </div>
    </div>

    <div class="profile-space-stats">
      <div><span>Промокоды</span><strong>{{ couponsCount }}</strong></div>
      <div><span>Группы</span><strong>{{ groupsCount }}</strong></div>
      <div><span>{{ space.type === 'shared' ? 'Участники' : 'Доступ' }}</span><strong>{{ space.type === 'shared' ? membersCount : '1' }}</strong></div>
    </div>
  </section>
</template>
