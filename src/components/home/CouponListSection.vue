<script setup lang="ts">
import type { Coupon, CouponGroup } from '../../types/domain';
import CouponCard from '../CouponCard.vue';
import EmptyState from '../EmptyState.vue';

type CouponCardPendingAction = 'favorite' | 'archive' | 'restore' | 'remove' | null;

defineProps<{
  title: string;
  coupons: Coupon[];
  showArchived: boolean;
  resolveGroup: (coupon: Coupon) => CouponGroup | null;
  resolvePendingAction: (coupon: Coupon) => CouponCardPendingAction;
}>();

const emit = defineEmits<{
  add: [];
  open: [coupon: Coupon];
  edit: [coupon: Coupon];
  favorite: [coupon: Coupon];
  archive: [coupon: Coupon];
  restore: [coupon: Coupon];
  remove: [coupon: Coupon];
}>();
</script>

<template>
  <section class="section coupons-section coupons-section--flat">
    <div class="section-title section-title--sticky">
      <div>
        <span>{{ showArchived ? 'Архив' : title }}</span>
        <small>{{ coupons.length }} {{ coupons.length === 1 ? 'позиция' : 'позиций' }}</small>
      </div>
      <button class="text-button" type="button" @click="emit('add')">+ Добавить</button>
    </div>

    <EmptyState
      v-if="coupons.length === 0"
      title="Пока пусто"
      :text="showArchived ? 'В архиве нет промокодов.' : 'Добавь первый QR или текстовый промокод.'"
    />

    <div v-else class="coupons-list coupons-list--product">
      <CouponCard
        v-for="coupon in coupons"
        :key="coupon.id"
        :coupon="coupon"
        :group="resolveGroup(coupon)"
        :pending-action="resolvePendingAction(coupon)"
        @open="emit('open', coupon)"
        @edit="emit('edit', coupon)"
        @favorite="emit('favorite', coupon)"
        @archive="emit('archive', coupon)"
        @restore="emit('restore', coupon)"
        @remove="emit('remove', coupon)"
      />
    </div>
  </section>
</template>
