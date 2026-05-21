<script setup lang="ts">
import BaseModal from './BaseModal.vue';
import type { Coupon, CouponGroup } from '../types/domain';
import type { ExpiringCouponInfo } from '../utils/expiry';
import { getExpiryLabel } from '../utils/expiry';
import { formatDate } from '../utils/date';

const props = defineProps<{
  modelValue: boolean;
  coupons: ExpiringCouponInfo[];
  groups: CouponGroup[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  open: [coupon: Coupon];
}>();

/** Closes the reminder modal without changing coupon data. */
function close() {
  emit('update:modelValue', false);
}

/**
 * Returns the readable group title for a coupon inside the active collection.
 * Coupons without a group are displayed as "Без группы".
 */
function getCouponGroupTitle(coupon: Coupon) {
  if (!coupon.group_id) return 'Без группы';

  return props.groups.find((group) => group.id === coupon.group_id)?.title ?? 'Группа удалена';
}

/** Opens a coupon from the reminder list and closes the modal. */
function openCoupon(coupon: Coupon) {
  emit('open', coupon);
  close();
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Скоро закончатся"
    subtitle="Эти промокоды действуют меньше недели. Проверь их перед покупкой."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="expiry-modal">
      <div class="expiry-modal__hero">
        <span class="expiry-modal__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 8v5" />
            <path d="M12 17h.01" />
            <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>

        <div>
          <strong>{{ props.coupons.length }}</strong>
          <p>промокодов скоро истекают</p>
        </div>
      </div>

      <div class="expiry-modal__list">
        <button
          v-for="item in props.coupons"
          :key="item.coupon.id"
          class="expiry-modal__item"
          type="button"
          @click="openCoupon(item.coupon)"
        >
          <span class="expiry-modal__item-main">
            <strong>{{ item.coupon.title }}</strong>

            <span class="expiry-modal__item-meta">
              <small class="expiry-modal__item-group">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
                </svg>
                {{ getCouponGroupTitle(item.coupon) }}
              </small>

              <small>Действует до {{ formatDate(item.coupon.expires_at) }}</small>
            </span>
          </span>

          <span class="expiry-modal__item-badge">
            {{ getExpiryLabel(item.daysLeft) }}
          </span>
        </button>
      </div>

      <button class="button button--primary" type="button" @click="close">
        Понятно
      </button>
    </div>
  </BaseModal>
</template>

<style scoped lang="scss">
.expiry-modal {
  display: grid;
  gap: 16px;
}

.expiry-modal__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, #f59e0b 24%, transparent);
  border-radius: 24px;
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, #f59e0b 18%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface-strong) 94%, transparent);

  strong {
    display: block;
    color: var(--text);
    font-size: 28px;
    font-weight: 950;
    line-height: 1;
  }

  p {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 13px;
    font-weight: 850;
  }
}

.expiry-modal__icon {
  display: grid;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, #fbbf24, #f97316);
  box-shadow: 0 14px 28px rgba(249, 115, 22, 0.22);

  svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.expiry-modal__list {
  display: grid;
  max-height: min(46vh, 420px);
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
}

.expiry-modal__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  border-radius: 20px;
  color: var(--text);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;

  &:hover {
    border-color: color-mix(in srgb, #f59e0b 30%, var(--border));
    background: color-mix(in srgb, #f59e0b 8%, var(--surface));
  }

  &:active {
    transform: scale(0.99);
  }
}

.expiry-modal__item-main {
  min-width: 0;

  strong {
    display: block;
    overflow: hidden;
    font-weight: 950;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.expiry-modal__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;

  small {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    padding: 5px 8px;
    border-radius: 999px;
    color: var(--muted);
    background: color-mix(in srgb, var(--surface-soft) 86%, transparent);
    font-size: 11px;
    font-weight: 850;
    line-height: 1.15;
  }
}

.expiry-modal__item-group {
  max-width: 100%;
  color: color-mix(in srgb, var(--accent) 78%, var(--text)) !important;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface)) !important;

  svg {
    width: 13px;
    height: 13px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.expiry-modal__item-badge {
  flex: 0 0 auto;
  padding: 8px 10px;
  border-radius: 999px;
  color: #92400e;
  background: color-mix(in srgb, #f59e0b 16%, var(--surface));
  font-size: 12px;
  font-weight: 950;
}

.primary-button--wide {
  width: 100%;
}
</style>
