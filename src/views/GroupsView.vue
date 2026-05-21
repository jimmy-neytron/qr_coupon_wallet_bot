<script setup lang="ts">
import GroupsGridSection from '../components/groups/GroupsGridSection.vue';
import GroupsHero from '../components/groups/GroupsHero.vue';
import { useWalletUi } from '../composables/walletUi';

const {
  activeGroupId,
  activeGroupTitle,
  visibleCouponsBase,
  groupsWithCounts,
  ungroupedCount,
  isTextModalSubmitting,
  textModalMode,
  createGroup,
  setTab,
  getGroupPendingAction,
  renameGroup,
  deleteGroup,
} = useWalletUi<any>();

function selectGroup(value: string | null | 'all') {
  activeGroupId.value = value;
  setTab('home');
}
</script>

<template>
  <section class="screen screen--groups">
    <GroupsHero
      :is-creating="isTextModalSubmitting && textModalMode === 'create-group'"
      @create="createGroup"
    />

    <GroupsGridSection
      :active-group-id="activeGroupId"
      :active-group-title="activeGroupTitle"
      :all-count="visibleCouponsBase.length"
      :ungrouped-count="ungroupedCount"
      :groups="groupsWithCounts"
      :get-pending-action="getGroupPendingAction"
      @select="selectGroup"
      @rename="renameGroup"
      @remove="deleteGroup"
    />
  </section>
</template>
