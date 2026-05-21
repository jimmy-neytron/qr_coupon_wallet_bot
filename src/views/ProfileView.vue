<script setup lang="ts">
import AccessPanel from '../components/profile/AccessPanel.vue';
import CollectionSummaryCard from '../components/profile/CollectionSummaryCard.vue';
import MembersCard from '../components/profile/MembersCard.vue';
import ProfileHero from '../components/profile/ProfileHero.vue';
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
    <ProfileHero :initial="profileInitial" :name="currentUserName" />

    <SpaceSwitcher
      :spaces="store.spaces"
      :selected-space-id="store.selectedSpaceId"
      :pending-space-id="pendingSpaceId"
      @select="selectSpace"
    />

    <CollectionSummaryCard
      v-if="store.selectedSpace"
      :space="store.selectedSpace"
      :subtitle="workspaceSubtitle"
      :coupons-count="store.activeCoupons.length"
      :groups-count="store.groups.length"
      :members-count="store.members.length"
    />

    <AccessPanel
      v-if="store.selectedSpace"
      :space="store.selectedSpace"
      :is-invite-creating="isInviteCreating"
      :is-text-modal-submitting="isTextModalSubmitting"
      @invite="openInviteModal"
      @create-shared-space="createSharedSpace"
      @join-by-code="joinByCode"
    />

    <MembersCard
      v-if="store.selectedSpace?.type === 'shared'"
      :members="store.members"
      :display-name="memberDisplayName"
    />
  </section>
</template>
