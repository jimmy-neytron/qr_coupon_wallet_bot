<script setup lang="ts">
import LoadingSpinner from '../components/LoadingSpinner.vue';
import SpaceSwitcher from '../components/SpaceSwitcher.vue';
import { useWalletUi } from '../composables/walletUi';

const {
  store,
  profileInitial,
  currentUserName,
  pendingSpaceId,
  workspaceSubtitle,
  isInviteCreating,
  isTextModalSubmitting,
  selectSpace,
  createSharedSpace,
  joinByCode,
  openInviteModal,
  memberDisplayName,
} = useWalletUi<any>();
</script>

<template>
  <section class="screen screen--profile">
    <section class="profile-hero">
      <div class="profile-avatar">{{ profileInitial }}</div>
      <div class="profile-hero__content">
        <p class="eyebrow">Профиль</p>
        <h2>{{ currentUserName }}</h2>
        <p>Управляй коллекциями отдельно от промокодов: выбирай активную, подключайся по коду и приглашай участников.</p>
      </div>
    </section>

    <SpaceSwitcher
      :spaces="store.spaces"
      :selected-space-id="store.selectedSpaceId"
      :pending-space-id="pendingSpaceId"
      @select="selectSpace"
    />

    <section v-if="store.selectedSpace" class="profile-space-card profile-space-card--selected">
      <div class="profile-space-card__head">
        <span class="workspace-icon" aria-hidden="true">
          <svg v-if="store.selectedSpace.type === 'personal'" viewBox="0 0 24 24">
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
          <h3>{{ store.selectedSpace.title }}</h3>
          <small>{{ workspaceSubtitle }}</small>
        </div>
      </div>

      <div class="profile-space-stats">
        <div><span>Промокоды</span><strong>{{ store.activeCoupons.length }}</strong></div>
        <div><span>Группы</span><strong>{{ store.groups.length }}</strong></div>
        <div><span>{{ store.selectedSpace.type === 'shared' ? 'Участники' : 'Доступ' }}</span><strong>{{ store.selectedSpace.type === 'shared' ? store.members.length : '1' }}</strong></div>
      </div>
    </section>

    <section v-if="store.selectedSpace" class="profile-actions-card profile-actions-card--access">
      <div class="section-title section-title--compact">
        <div>
          <span>Совместный доступ</span>
          <small v-if="store.selectedSpace.type === 'shared'">Люди ниже видят и редактируют именно эту выбранную коллекцию.</small>
          <small v-else>Личная коллекция приватная. Для общего доступа создай отдельную общую коллекцию.</small>
        </div>
      </div>

      <div v-if="store.selectedSpace.type === 'shared'" class="access-shared-layout">
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
            <small>Новый участник получит доступ к группам и промокодам только внутри “{{ store.selectedSpace.title }}”.</small>
          </span>
        </div>

        <button class="invite-cta invite-cta--profile" type="button" :disabled="isInviteCreating" @click="openInviteModal">
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

        <button class="invite-cta invite-cta--soft" type="button" :disabled="isTextModalSubmitting" @click="createSharedSpace">
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

        <button class="invite-cta invite-cta--soft" type="button" :disabled="isTextModalSubmitting" @click="joinByCode">
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

    <section v-if="store.selectedSpace?.type === 'shared'" class="profile-members-card profile-members-card--shared">
      <div class="section-title section-title--compact">
        <div>
          <span>Участники коллекции</span>
          <small>{{ store.members.length }} {{ store.members.length === 1 ? 'человек' : 'участника' }} с доступом</small>
        </div>
      </div>

      <div class="members-list">
        <article v-for="member in store.members" :key="member.user_id" class="member-row">
          <span class="member-avatar">{{ memberDisplayName(member).slice(0, 1).toUpperCase() }}</span>
          <span>
            <strong>{{ memberDisplayName(member) }}</strong>
            <small>{{ member.role === 'owner' ? 'Владелец' : 'Участник' }}</small>
          </span>
        </article>
      </div>
    </section>
  </section>
</template>
