<script setup lang="ts">
import type { Space } from '../../types/domain';
import LoadingSpinner from '../LoadingSpinner.vue';

defineProps<{
  space: Space;
  isInviteCreating: boolean;
  isTextModalSubmitting: boolean;
}>();

const emit = defineEmits<{
  invite: [];
  createSharedSpace: [];
  joinByCode: [];
}>();
</script>

<template>
  <section class="profile-actions-card profile-actions-card--access">
    <div class="section-title section-title--compact">
      <div>
        <span>Совместный доступ</span>
        <small v-if="space.type === 'shared'">Люди ниже видят и редактируют именно эту выбранную коллекцию.</small>
        <small v-else>Личная коллекция приватная. Для общего доступа создай отдельную общую коллекцию.</small>
      </div>
    </div>

    <div v-if="space.type === 'shared'" class="access-shared-layout">
      <div class="access-explainer access-explainer--shared">
        <span class="access-explainer__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <span>
          <strong>Это общая коллекция</strong>
          <small>Новый участник получит доступ к группам и промокодам только внутри “{{ space.title }}”.</small>
        </span>
      </div>

      <button class="invite-cta invite-cta--profile" type="button" :disabled="isInviteCreating" @click="emit('invite')">
        <LoadingSpinner v-if="isInviteCreating" />
        <span v-else class="invite-cta__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6" />
            <path d="M16 11h6" />
          </svg>
        </span>
        <span>
          <strong>{{ isInviteCreating ? 'Создаю код...' : 'Пригласить участника' }}</strong>
          <small>Сгенерируй код и отправь его девушке или близким.</small>
        </span>
        <em>Код</em>
      </button>
    </div>

    <div v-else class="personal-space-actions personal-space-actions--profile">
      <div class="access-explainer">
        <span class="access-explainer__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 15v2" />
            <rect x="5" y="10" width="14" height="10" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <span>
          <strong>Личная коллекция не расшаривается</strong>
          <small>Так безопаснее: общие купоны живут отдельно, а личные остаются только у тебя.</small>
        </span>
      </div>

      <button class="invite-cta invite-cta--soft" type="button" :disabled="isTextModalSubmitting" @click="emit('createSharedSpace')">
        <span class="invite-cta__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <span>
          <strong>Создать общую коллекцию</strong>
          <small>Для пары, семьи или друзей. Потом можно отправить код приглашения.</small>
        </span>
      </button>

      <button class="invite-cta invite-cta--soft" type="button" :disabled="isTextModalSubmitting" @click="emit('joinByCode')">
        <span class="invite-cta__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="16" rx="4" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
        </span>
        <span>
          <strong>Войти по коду</strong>
          <small>Подключиться к общей коллекции, куда тебя пригласили.</small>
        </span>
      </button>
    </div>
  </section>
</template>
