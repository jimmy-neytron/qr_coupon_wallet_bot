<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import BaseSelect, { type SelectOption } from './BaseSelect.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import type { Coupon, CouponGroup, CouponType, CreateCouponPayload } from '../types/domain';

const props = defineProps<{
  modelValue: boolean;
  groups: CouponGroup[];
  initialCoupon?: Coupon | null;
  initialQrText?: string;
  initialGroupId?: string | null;
  initialType?: CouponType;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: CreateCouponPayload];
}>();

const form = reactive<CreateCouponPayload>({
  title: '',
  qr_text: '',
  type: 'qr',
  group_id: null,
  note: '',
  expires_at: null,
});

const title = computed(() => (props.initialCoupon ? 'Редактировать купон' : 'Добавить купон'));

const typeOptions: SelectOption[] = [
  {
    value: 'qr',
    label: 'QR-код',
    description: 'Для купонов, карт и ссылок в QR',
    icon: '▦',
  },
  {
    value: 'text',
    label: 'Текстовый промокод',
    description: 'SALE500, APPLE15 или ссылка',
    icon: '%',
  },
];

const groupOptions = computed<SelectOption[]>(() => [
  {
    value: null,
    label: 'Без группы',
    description: 'Сохранить в общий список',
    icon: '•',
  },
  ...props.groups.map((group) => ({
    value: group.id,
    label: group.title,
    description: 'Группа купонов',
    icon: group.title.trim().slice(0, 1).toUpperCase() || '•',
  })),
]);

const typeSelectValue = computed<string | null>({
  get: () => form.type,
  set: (value) => {
    form.type = value === 'text' ? 'text' : 'qr';
  },
});

const groupSelectValue = computed<string | null>({
  get: () => form.group_id ?? null,
  set: (value) => {
    form.group_id = value;
  },
});

function fillForm() {
  form.title = props.initialCoupon?.title ?? (props.initialType === 'text' ? 'Новый промокод' : 'Новый QR-купон');
  form.qr_text = props.initialCoupon?.qr_text ?? props.initialQrText ?? '';
  form.type = props.initialCoupon?.type ?? props.initialType ?? 'qr';
  form.group_id = props.initialCoupon?.group_id ?? props.initialGroupId ?? null;
  form.note = props.initialCoupon?.note ?? '';
  form.expires_at = props.initialCoupon?.expires_at ?? null;
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) fillForm();
  },
);

function submit() {
  if (props.isSaving) return;

  const qrText = form.qr_text.trim();
  const couponTitle = form.title.trim();

  if (!couponTitle || !qrText) return;

  emit('save', {
    title: couponTitle,
    qr_text: qrText,
    type: form.type,
    group_id: form.group_id || null,
    note: form.note?.trim() || null,
    expires_at: form.expires_at || null,
  });
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    subtitle="Заполни основные данные. Купон сразу появится в выбранной коллекции."
    :is-busy="isSaving"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="form coupon-form" @submit.prevent="submit">
      <div class="form-grid form-grid--two">
        <label class="field field--select">
          <span>Тип</span>
          <BaseSelect v-model="typeSelectValue" :options="typeOptions" :disabled="isSaving" />
        </label>

        <label class="field field--select">
          <span>Группа</span>
          <BaseSelect v-model="groupSelectValue" :options="groupOptions" :disabled="isSaving" />
        </label>
      </div>

      <label class="field">
        <span>Название</span>
        <input v-model="form.title" type="text" placeholder="Например, Магнит 10%" maxlength="120" :disabled="isSaving" required />
      </label>

      <label class="field">
        <span>{{ form.type === 'qr' ? 'Строка из QR' : 'Промокод / ссылка' }}</span>
        <textarea v-model="form.qr_text" rows="4" placeholder="SALE500 или https://..." :disabled="isSaving" required />
      </label>

      <div class="form-grid form-grid--two form-grid--compact">
        <label class="field">
          <span>Срок действия</span>
          <input v-model="form.expires_at" type="date" :disabled="isSaving" />
        </label>

        <div class="form-hint-card">
          <strong>{{ form.type === 'qr' ? 'QR будет восстановлен' : 'Промокод будет крупным' }}</strong>
          <span>{{ form.type === 'qr' ? 'Приложение сгенерирует такой же QR из сохранённой строки.' : 'На экране просмотра код будет удобно показать или скопировать.' }}</span>
        </div>
      </div>

      <label class="field">
        <span>Заметка</span>
        <textarea v-model="form.note" rows="3" placeholder="Например, условия применения" :disabled="isSaving" />
      </label>

      <div class="modal-actions-row modal-actions-row--sticky">
        <button class="button button--ghost" type="button" :disabled="isSaving" @click="emit('update:modelValue', false)">Отмена</button>
        <button class="button button--primary" type="submit" :disabled="isSaving || !form.title.trim() || !form.qr_text.trim()">
          <LoadingSpinner v-if="isSaving" />
          <span>{{ isSaving ? 'Сохраняю...' : 'Сохранить' }}</span>
        </button>
      </div>
    </form>
  </BaseModal>
</template>
