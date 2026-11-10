<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { TicketSummary } from '@/api'
import { formatAgo } from '@/utils/format'
import { ticketCode } from '@/utils/ticket'
import PriorityLabel from './PriorityLabel.vue'
import StatusTag from './StatusTag.vue'

// Linha curta de chamado (Início): número, título, status, prioridade e quando mudou.
defineProps<{ ticket: TicketSummary }>()
</script>

<template>
  <RouterLink :to="{ name: 'ticket', params: { id: ticket.id } }" class="db-row db-row--link mini">
    <span class="cell-muted">{{ ticketCode(ticket) }}</span>
    <span class="truncate strong-500" :title="ticket.title">{{ ticket.title }}</span>
    <StatusTag :status="ticket.status" style="justify-self: start" />
    <PriorityLabel :priority="ticket.priority" />
    <span class="cell-muted" style="text-align: right">{{ formatAgo(ticket.updatedAt ?? ticket.createdAt) }}</span>
  </RouterLink>
</template>

<style scoped>
.mini {
  --cols: 64px minmax(160px, 1fr) 124px 84px 82px;
  min-height: 48px;
  padding: 0 4px;
}
.strong-500 {
  font-weight: 500;
}
</style>
