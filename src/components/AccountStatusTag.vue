<script setup lang="ts">
import { computed } from 'vue'
import type { UserStatus } from '@/api'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ status: UserStatus }>()

const view = computed(() => {
  switch (props.status) {
    case 'ACTIVE':
      return { label: 'Ativa', modifier: 'tag--success' }
    case 'BLOCKED':
      return { label: 'Bloqueada', modifier: 'tag--danger' }
    case 'PENDING_VERIFICATION':
      return { label: 'Confirmando e-mail', modifier: 'tag--progress' }
    case 'DEACTIVATED':
      return { label: 'Desativada', modifier: 'tag--closed' }
    default:
      return { label: 'Anonimizada', modifier: 'tag--closed' }
  }
})
</script>

<template>
  <span class="tag" :class="view.modifier">
    <AppIcon v-if="status === 'BLOCKED'" name="lock" :size="12" :stroke-width="2.2" />{{ view.label }}
  </span>
</template>
