<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';
import type { Coupon, CouponGroup } from '../types/domain';
import { displayUserName } from '../utils/text';
import { formatDate, isExpired } from '../utils/date';

type CouponCardPendingAction = 'favorite' | 'archive' | 'restore' | 'remove' | null;

const props = withDefaults(
  defineProps<{
    coupon: Coupon;
    group?: CouponGroup | null;
    pendingAction?: CouponCardPendingAction;
  }>(),
  {
    group: null,
    pendingAction: null,
  },
);

const emit = defineEmits<{
  open: [];
  edit: [];
  favorite: [];
  archive: [];
  restore: [];
  remove: [];
}>();

function emitIfFree(eventName: 'open' | 'edit' | 'favorite' | 'archive' | 'restore' | 'remove') {
  if (props.pendingAction) return;

  if (eventName === 'open') emit('open');
  if (eventName === 'edit') emit('edit');
  if (eventName === 'favorite') emit('favorite');
  if (eventName === 'archive') emit('archive');
  if (eventName === 'restore') emit('restore');
  if (eventName === 'remove') emit('remove');
}
</script>

<template>
  <article class="coupon-card" :class="{ 'coupon-card--expired': isExpired(props.coupon.expires_at), 'coupon-card--favorite': coupon.is_favorite, 'coupon-card--pending': pendingAction }">
    <button class="coupon-card__main" type="button" :disabled="Boolean(pendingAction)" @click="emitIfFree('open')">
      <span class="coupon-type" :class="`coupon-type--${coupon.type}`" aria-hidden="true">
        <svg v-if="coupon.type === 'qr'" viewBox="0 0 24 24">
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <path d="M14 14h2.5v2.5H14z" />
          <path d="M18 14h2v6h-6v-2h4z" />
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.25a2.25 2.25 0 0 0 0 4.5v1.25A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-1.25a2.25 2.25 0 0 0 0-4.5z" />
          <path d="m9 15 6-6" />
          <circle cx="9" cy="9" r="1" />
          <circle cx="15" cy="15" r="1" />
        </svg>
      </span>

      <span class="coupon-card__content">
        <span class="coupon-card__topline">
          <strong>{{ coupon.title }}</strong>
          <em v-if="coupon.is_favorite" aria-label="В избранном">★</em>
        </span>
        <small>{{ group?.title ?? 'Без группы' }} · добавил {{ displayUserName(coupon.created_by) }}</small>
        <small v-if="coupon.expires_at" :class="{ danger: isExpired(coupon.expires_at) }">
          Действует до {{ formatDate(coupon.expires_at) }}
        </small>
      </span>
    </button>

    <div class="coupon-card__actions">
      <button class="icon-action" type="button" :disabled="Boolean(pendingAction)" :title="coupon.is_favorite ? 'Убрать из избранного' : 'В избранное'" @click="emitIfFree('favorite')">
        <LoadingSpinner v-if="pendingAction === 'favorite'" />
        <template v-else>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6L12 16.77 6.6 19.6l1.03-6-4.36-4.25 6.03-.88z" />
          </svg>
        </template>
      </button>

      <button class="icon-action" type="button" :disabled="Boolean(pendingAction)" title="Редактировать" @click="emitIfFree('edit')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      <button v-if="!coupon.is_archived" class="icon-action" type="button" :disabled="Boolean(pendingAction)" title="Архивировать" @click="emitIfFree('archive')">
        <LoadingSpinner v-if="pendingAction === 'archive'" />
        <template v-else>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="4" rx="1.5" />
            <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
            <path d="m9 13 3 3 3-3" />
            <path d="M12 11v5" />
          </svg>
        </template>
      </button>

      <button v-else class="icon-action" type="button" :disabled="Boolean(pendingAction)" title="Вернуть" @click="emitIfFree('restore')">
        <LoadingSpinner v-if="pendingAction === 'restore'" />
        <template v-else>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="4" rx="1.5" />
            <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
            <path d="m9 15 3-3 3 3" />
            <path d="M12 12v5" />
          </svg>
        </template>
      </button>

      <button class="icon-action icon-action--danger" type="button" :disabled="Boolean(pendingAction)" title="Удалить" @click="emitIfFree('remove')">
        <LoadingSpinner v-if="pendingAction === 'remove'" />
        <template v-else>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6 18 20H6L5 6" />
            <path d="M10 11v5" />
            <path d="M14 11v5" />
          </svg>
        </template>
      </button>
    </div>
  </article>
</template>
