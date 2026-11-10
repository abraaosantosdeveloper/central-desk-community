<script setup lang="ts">
import { computed } from 'vue'
import type { TicketStatus } from '@/api'
import { STATUS_LABELS } from '@/utils/ticket'

const props = defineProps<{ status: TicketStatus }>()
const modifier = computed(() =>
  props.status === 'OPEN' ? 'tag--open' : props.status === 'IN_PROGRESS' ? 'tag--progress' : 'tag--closed',
)
</script>

<template>
  <span class="tag" :class="modifier">{{ STATUS_LABELS[status] }}</span>
</template>
