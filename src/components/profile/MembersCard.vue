<script setup lang="ts">
import type { SpaceMember } from '../../types/domain';

defineProps<{
  members: SpaceMember[];
  displayName: (member: SpaceMember) => string;
}>();
</script>

<template>
  <section class="profile-members-card profile-members-card--shared">
    <div class="section-title section-title--compact">
      <div>
        <span>Участники коллекции</span>
        <small>{{ members.length }} {{ members.length === 1 ? 'человек' : 'участника' }} с доступом</small>
      </div>
    </div>

    <div class="members-list">
      <article v-for="member in members" :key="member.user_id" class="member-row">
        <span class="member-avatar">{{ displayName(member).slice(0, 1).toUpperCase() }}</span>
        <span>
          <strong>{{ displayName(member) }}</strong>
          <small>{{ member.role === 'owner' ? 'Владелец' : 'Участник' }}</small>
        </span>
      </article>
    </div>
  </section>
</template>
