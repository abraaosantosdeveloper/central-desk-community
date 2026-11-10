<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { errorMessage, ticketsApi, type TicketSummary } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import CategoryLabel from '@/components/CategoryLabel.vue'
import LiveIndicator from '@/components/LiveIndicator.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import PriorityLabel from '@/components/PriorityLabel.vue'
import StateMessage from '@/components/StateMessage.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import { formatAgo } from '@/utils/format'
import { REOPEN_WINDOW_DAYS, ticketCode } from '@/utils/ticket'

// "Meus atendimentos" como quadro: em andamento e encerrados recentes. O status não se arrasta:
// ele muda pelas ações do chamado (assumir, encerrar, reabrir), como a API exige.

const auth = useAuthStore()
const realtime = useRealtimeStore()

const inProgress = ref<TicketSummary[]>([])
const inProgressTotal = ref(0)
const closed = ref<TicketSummary[]>([])
const loading = ref(true)
const error = ref('')

const recentClosed = computed(() => {
  const limit = Date.now() - REOPEN_WINDOW_DAYS * 86_400_000
  return closed.value.filter((ticket) => new Date(ticket.updatedAt ?? ticket.createdAt).getTime() >= limit)
})

async function load() {
  error.value = ''
  try {
    const [progress, done] = await Promise.all([
      ticketsApi.list('assigned', { status: 'IN_PROGRESS', orderBy: 'PRIORITY', size: 50 }),
      ticketsApi.list('assigned', { status: 'CLOSED', orderBy: 'RECENT', size: 20 }),
    ])
    inProgress.value = progress.content
    inProgressTotal.value = progress.totalElements
    closed.value = done.content
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

const stops: (() => void)[] = []
onMounted(() => {
  void load()
  stops.push(realtime.onConnected(() => void load()), realtime.on('queue.changed', () => void load()))
})
onUnmounted(() => stops.forEach((stop) => stop()))
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Chamados' }, { label: 'Meus atendimentos' }]">
    <LiveIndicator />
  </PageTopbar>

  <div class="page page--wide">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Chamados</h1>
        <p class="page-subtitle">Pedidos de suporte de todos os setores, destinados a {{ SUPPORT_TEAM_NAME }}.</p>
      </div>
    </div>

    <nav class="tabs" aria-label="Visualizações">
      <RouterLink :to="{ name: 'queue' }" class="tab"><AppIcon name="table" :size="16" />Fila de atendimento</RouterLink>
      <RouterLink :to="{ name: 'board' }" class="tab is-active" aria-current="page">
        <AppIcon name="board" :size="16" />Meus atendimentos <span class="tab__count">{{ inProgressTotal }}</span>
      </RouterLink>
      <RouterLink :to="{ name: 'mine' }" class="tab"><AppIcon name="doc" :size="16" />Meus chamados</RouterLink>
      <RouterLink v-if="auth.canBrowseAllTickets" :to="{ name: 'all-tickets' }" class="tab">
        <AppIcon name="layers" :size="16" />{{ auth.isAdmin ? 'Todos os chamados' : 'Chamados do setor' }}
      </RouterLink>
    </nav>

    <StateMessage v-if="error" state="error" :message="error" @retry="load" />
    <StateMessage v-else-if="loading" state="loading" />

    <div v-else class="board">
      <section aria-labelledby="col-andamento" class="board__column">
        <h2 id="col-andamento" class="board__title">
          <span class="tag tag--progress">Em andamento</span>
          <span class="board__count">{{ inProgressTotal }}</span>
        </h2>
        <p v-if="!inProgress.length" class="empty small">Nada com você agora. <RouterLink :to="{ name: 'queue' }">Ver a fila</RouterLink></p>
        <RouterLink
          v-for="ticket in inProgress"
          :key="ticket.id"
          :to="{ name: 'ticket', params: { id: ticket.id } }"
          class="card-ticket"
        >
          <span class="card-ticket__title">{{ ticket.title }}</span>
          <span class="card-ticket__meta">
            <span>{{ ticketCode(ticket) }}</span>
            <CategoryLabel :category="ticket.category" />
            <PriorityLabel :priority="ticket.priority" compact />
          </span>
          <span class="card-ticket__foot">
            <UserAvatar :name="ticket.requesterName" :size="22" />
            <span class="truncate" style="flex: 1">{{ ticket.requesterName }} · {{ ticket.originDepartment?.name ?? '—' }}</span>
            <span>{{ formatAgo(ticket.updatedAt ?? ticket.createdAt) }}</span>
          </span>
        </RouterLink>
      </section>

      <section aria-labelledby="col-encerrados" class="board__column">
        <h2 id="col-encerrados" class="board__title">
          <span class="tag tag--closed">Encerrados</span>
          <span class="board__count">últimos {{ REOPEN_WINDOW_DAYS }} dias · {{ recentClosed.length }}</span>
        </h2>
        <p v-if="!recentClosed.length" class="empty small">Nenhum encerramento nos últimos {{ REOPEN_WINDOW_DAYS }} dias.</p>
        <RouterLink
          v-for="ticket in recentClosed"
          :key="ticket.id"
          :to="{ name: 'ticket', params: { id: ticket.id } }"
          class="card-ticket card-ticket--closed"
        >
          <span class="card-ticket__title">{{ ticket.title }}</span>
          <span class="card-ticket__meta">
            <span>{{ ticketCode(ticket) }}</span>
            <CategoryLabel :category="ticket.category" />
            <span>Encerrado {{ formatAgo(ticket.updatedAt ?? ticket.createdAt) }}</span>
          </span>
          <span class="card-ticket__foot">
            <UserAvatar :name="ticket.requesterName" :size="22" />
            <span class="truncate">{{ ticket.requesterName }}</span>
          </span>
        </RouterLink>
      </section>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  align-items: start;
}
.board__column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.board__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.board__count {
  color: var(--muted);
  font-weight: 500;
  font-size: 13px;
}
.card-ticket {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  color: var(--text);
}
.card-ticket:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.card-ticket--closed {
  background: var(--surface-faint);
  box-shadow: none;
}
.card-ticket--closed .card-ticket__title {
  color: var(--text-2);
}
.card-ticket__title {
  font-weight: 600;
}
.card-ticket__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 12px;
  color: var(--muted);
}
.card-ticket__meta :deep(.category),
.card-ticket__meta :deep(.priority) {
  font-size: 12px;
}
.card-ticket__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
}
</style>
