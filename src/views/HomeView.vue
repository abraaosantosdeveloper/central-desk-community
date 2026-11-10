<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { errorMessage, ticketsApi, type TicketSummary } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import LiveIndicator from '@/components/LiveIndicator.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import StateMessage from '@/components/StateMessage.vue'
import TicketMiniRow from '@/components/TicketMiniRow.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCountersStore } from '@/stores/counters'
import { useRealtimeStore } from '@/stores/realtime'
import { formatAgo, formatToday, greeting } from '@/utils/format'

const auth = useAuthStore()
const counters = useCountersStore()
const activity = useActivityStore()
const realtime = useRealtimeStore()

const loading = ref(true)
const error = ref('')
const assigned = ref<TicketSummary[]>([])
const assignedTotal = ref(0)
const mine = ref<TicketSummary[]>([])
const mineOpen = ref(0)
const mineInProgress = ref(0)
const mineClosed = ref(0)
const criticalInQueue = ref(0)

const firstName = computed(() => auth.currentUser?.fullName.split(/\s+/)[0] ?? '')
const recentActivity = computed(() => activity.items.slice(0, 5))

async function load() {
  error.value = ''
  try {
    const requests: Promise<unknown>[] = [
      ticketsApi.list('mine', { size: 5 }).then((page) => (mine.value = page.content)),
      ticketsApi.list('mine', { status: 'OPEN', size: 1 }).then((page) => (mineOpen.value = page.totalElements)),
      ticketsApi.list('mine', { status: 'IN_PROGRESS', size: 1 }).then((page) => (mineInProgress.value = page.totalElements)),
      ticketsApi.list('mine', { status: 'CLOSED', size: 1 }).then((page) => (mineClosed.value = page.totalElements)),
    ]
    if (auth.canHandleTickets) {
      requests.push(
        ticketsApi.list('assigned', { status: 'IN_PROGRESS', orderBy: 'PRIORITY', size: 5 }).then((page) => {
          assigned.value = page.content
          assignedTotal.value = page.totalElements
        }),
        ticketsApi.list('queue', { priorityId: 4, size: 1 }).then((page) => (criticalInQueue.value = page.totalElements)),
      )
    }
    await Promise.all(requests)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleReload() {
  clearTimeout(timer)
  timer = setTimeout(() => void load(), 600)
}

const stops: (() => void)[] = []
onMounted(() => {
  void load()
  stops.push(
    realtime.on('queue.changed', scheduleReload),
    realtime.on('comment.created', scheduleReload),
    realtime.onConnected(scheduleReload),
  )
})
onUnmounted(() => {
  clearTimeout(timer)
  stops.forEach((stop) => stop())
})
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Início' }]">
    <LiveIndicator />
    <RouterLink :to="{ name: 'activity' }" class="btn btn--icon" style="position: relative" :aria-label="`Notificações, ${activity.unread} não lidas`">
      <AppIcon name="bell" :size="20" />
      <span v-if="activity.unread" class="bell-dot" aria-hidden="true" />
    </RouterLink>
    <RouterLink :to="{ name: 'new-ticket' }" class="btn btn--primary">
      <AppIcon name="plus" :size="16" :stroke-width="2" />Novo chamado
    </RouterLink>
  </PageTopbar>

  <div class="page page--medium" style="gap: 32px; padding-top: 32px">
    <div style="display: flex; flex-direction: column; gap: 6px">
      <p class="small muted">{{ formatToday() }}</p>
      <h1 class="page-title">{{ greeting() }}, {{ firstName }}</h1>
    </div>

    <RouterLink v-if="auth.isAdmin && counters.pendingApprovals > 0" :to="{ name: 'approvals' }" class="callout callout-link">
      <AppIcon name="info" :size="20" style="color: var(--text-2)" />
      <span style="flex: 1">
        {{ counters.pendingApprovals === 1 ? '1 pedido' : `${counters.pendingApprovals} pedidos` }} de entrada em
        <strong style="font-weight: 600">{{ SUPPORT_TEAM_NAME }}</strong>
        {{ counters.pendingApprovals === 1 ? 'aguarda' : 'aguardam' }} sua aprovação.
        <span class="callout-link__cta">Revisar pedidos</span>
      </span>
    </RouterLink>

    <div v-if="auth.currentUser?.departmentApprovalPending" class="callout">
      <AppIcon name="clock" :size="20" style="color: var(--text-2)" />
      <span>Seu pedido para entrar em <strong style="font-weight: 600">{{ SUPPORT_TEAM_NAME }}</strong> aguarda um administrador. Enquanto isso, você já pode abrir chamados.</span>
    </div>

    <StateMessage v-if="error" state="error" :message="error" @retry="load" />

    <section aria-label="Resumo" class="stat-grid">
      <template v-if="auth.canHandleTickets">
        <RouterLink :to="{ name: 'queue' }" class="stat">
          <span class="stat__label">Na fila</span>
          <span class="stat__value">{{ counters.queueOpen }}</span>
          <span v-if="criticalInQueue" class="stat__note stat__note--danger">{{ criticalInQueue === 1 ? '1 crítico' : `${criticalInQueue} críticos` }}</span>
          <span v-else class="stat__note">nenhum crítico</span>
        </RouterLink>
        <RouterLink :to="{ name: 'board' }" class="stat">
          <span class="stat__label">Comigo, em andamento</span>
          <span class="stat__value">{{ loading ? '–' : assignedTotal }}</span>
          <span class="stat__note">ordenados por prioridade</span>
        </RouterLink>
      </template>
      <RouterLink :to="{ name: 'mine' }" class="stat">
        <span class="stat__label">Abertos por mim</span>
        <span class="stat__value">{{ loading ? '–' : mineOpen + mineInProgress }}</span>
        <span class="stat__note">{{ mineOpen }} aguardando atendimento</span>
      </RouterLink>
      <RouterLink :to="{ name: 'mine', query: { status: 'CLOSED' } }" class="stat">
        <span class="stat__label">Meus chamados encerrados</span>
        <span class="stat__value">{{ loading ? '–' : mineClosed }}</span>
        <span class="stat__note">reabertura em até 7 dias</span>
      </RouterLink>
    </section>

    <div class="row-wrap">
      <div style="flex: 2 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 28px">
        <section v-if="auth.canHandleTickets" style="display: flex; flex-direction: column; gap: 8px">
          <div class="section-head">
            <h2 class="section-title">Meus atendimentos</h2>
            <RouterLink :to="{ name: 'board' }" class="section-link">Abrir quadro</RouterLink>
          </div>
          <StateMessage v-if="loading" state="loading" />
          <p v-else-if="!assigned.length" class="empty">Nenhum chamado com você agora. <RouterLink :to="{ name: 'queue' }">Ver a fila</RouterLink></p>
          <div v-else class="table-scroll" style="border-top: 1px solid var(--border)">
            <div class="db-table" style="--table-min: 560px">
              <TicketMiniRow v-for="ticket in assigned" :key="ticket.id" :ticket="ticket" />
            </div>
          </div>
        </section>

        <section style="display: flex; flex-direction: column; gap: 8px">
          <div class="section-head">
            <h2 class="section-title">Abertos por mim</h2>
            <RouterLink :to="{ name: 'mine' }" class="section-link">Ver todos</RouterLink>
          </div>
          <StateMessage v-if="loading" state="loading" />
          <p v-else-if="!mine.length" class="empty">
            Você ainda não abriu chamados. <RouterLink :to="{ name: 'new-ticket' }">Abrir o primeiro</RouterLink>
          </p>
          <div v-else class="table-scroll" style="border-top: 1px solid var(--border)">
            <div class="db-table" style="--table-min: 560px">
              <TicketMiniRow v-for="ticket in mine" :key="ticket.id" :ticket="ticket" />
            </div>
          </div>
        </section>
      </div>

      <aside aria-labelledby="atividade" style="flex: 1 1 280px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
        <div class="section-head">
          <h2 id="atividade" class="section-title">Atividade</h2>
          <RouterLink :to="{ name: 'activity' }" class="section-link">Ver tudo</RouterLink>
        </div>
        <p v-if="!recentActivity.length" class="small muted" style="padding: 12px 4px; border-top: 1px solid var(--border)">
          Nada novo desde que você entrou. Comentários e chamados novos aparecem aqui na hora.
        </p>
        <ol v-else class="activity-list">
          <li v-for="item in recentActivity" :key="item.id">
            <UserAvatar v-if="item.actor" :name="item.actor" />
            <span v-else class="activity-list__icon" aria-hidden="true"><AppIcon :name="item.category === 'ADMINISTRATION' ? 'approve' : 'plus'" :size="14" :stroke-width="2" /></span>
            <span style="display: flex; flex-direction: column; gap: 2px; min-width: 0">
              <span>
                <strong v-if="item.actor" style="font-weight: 600">{{ item.actor }}</strong>
                {{ item.text }}
                <RouterLink v-if="item.link" :to="item.link" style="text-decoration: none">{{ item.linkLabel }}</RouterLink>
              </span>
              <span class="xsmall muted">{{ formatAgo(item.at) }} · {{ item.category === 'TICKETS' ? 'Chamados' : 'Administração' }}</span>
            </span>
          </li>
        </ol>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.bell-dot {
  position: absolute;
  top: 10px;
  right: 11px;
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--accent);
  border: 2px solid var(--bg);
}
.callout-link {
  text-decoration: none;
  color: var(--text);
}
.callout-link:hover {
  background: var(--hover);
  color: var(--text);
}
.callout-link__cta {
  color: var(--accent);
  font-weight: 600;
}
.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--border);
}
.activity-list li {
  display: flex;
  gap: 10px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border);
}
.activity-list__icon {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  background: var(--closed-tint);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
