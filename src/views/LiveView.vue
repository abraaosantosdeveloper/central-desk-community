<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { dashboardApi, errorMessage, ticketsApi, type Metrics, type StatusCounts } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import LiveIndicator from '@/components/LiveIndicator.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import StateMessage from '@/components/StateMessage.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useRealtimeStore } from '@/stores/realtime'
import { daysAgo, formatNumber, isoDay } from '@/utils/format'
import { ticketCode } from '@/utils/ticket'

// Painel ao vivo (BI): chamados em aberto, em andamento, total e por setor. Os números vêm prontos da
// API ("Todos os chamados" e métricas dos últimos 12 meses) e são atualizados a cada evento em tempo real.

const auth = useAuthStore()
const catalog = useCatalogStore()
const realtime = useRealtimeStore()

const counts = ref<StatusCounts | null>(null)
const metrics = ref<Metrics | null>(null)
const queueByPriority = ref<{ id: number; label: string; count: number }[]>([])
const loading = ref(true)
const error = ref('')
const updatedAt = ref<Date | null>(null)
const events = ref<{ id: number; at: Date; text: string }[]>([])
let eventId = 1

const PRIORITY_COLORS: Record<number, string> = { 4: '#B42318', 3: '#1F1F1D', 2: '#77766F', 1: '#D6D5D1' }

const groups = computed(() => {
  if (!metrics.value) return []
  const source = auth.isAdmin ? metrics.value.byOriginDepartment : metrics.value.byCategory
  return [...source].sort((a, b) => b.count - a.count)
})
const groupMax = computed(() => Math.max(1, ...groups.value.map((group) => group.count)))
const handlersBusy = computed(() => metrics.value?.byAssignee.filter((person) => person.inProgress > 0).length ?? 0)
const queueTotal = computed(() => queueByPriority.value.reduce((sum, item) => sum + item.count, 0))

const scopeText = computed(() =>
  auth.isAdmin ? 'em todos os setores' : `de ${auth.currentUser?.departmentName ?? 'seu setor'} (abertos ou recebidos)`,
)

async function load() {
  error.value = ''
  try {
    await catalog.loadTicketOptions().catch(() => undefined)
    const priorities = [...catalog.priorities].sort((a, b) => b.id - a.id)
    const [overview, loadedMetrics, ...perPriority] = await Promise.all([
      ticketsApi.overview({ size: 1 }),
      dashboardApi.metrics({ from: isoDay(daysAgo(365)), to: isoDay(new Date()) }),
      ...priorities.map((priority) => ticketsApi.overview({ status: 'OPEN', priorityId: priority.id, size: 1 })),
    ])
    counts.value = overview.statusCounts
    metrics.value = loadedMetrics
    queueByPriority.value = priorities.map((priority, index) => ({
      id: priority.id,
      label: priority.label,
      count: perPriority[index]?.totalElements ?? 0,
    }))
    updatedAt.value = new Date()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleReload() {
  clearTimeout(timer)
  timer = setTimeout(() => void load(), 800)
}

function logEvent(text: string) {
  events.value = [{ id: eventId++, at: new Date(), text }, ...events.value].slice(0, 8)
}

const REASONS: Record<string, string> = {
  OPENED: 'Chamado novo na fila',
  ASSIGNED: 'Chamado assumido',
  CLOSED: 'Chamado encerrado na fila',
  RETURNED: 'Chamados devolvidos à fila',
}

const stops: (() => void)[] = []
let interval: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void load()
  stops.push(
    realtime.on('ticket.created', (ticket) => {
      logEvent(`${ticketCode(ticket)} aberto por ${ticket.originDepartment?.name ?? ticket.requesterName}`)
      scheduleReload()
    }),
    realtime.on('queue.changed', (event) => {
      if (event.reason !== 'OPENED') logEvent(`${REASONS[event.reason] ?? 'Fila atualizada'} · ${event.openCount} na fila`)
      scheduleReload()
    }),
    realtime.onConnected(scheduleReload),
  )
  interval = setInterval(() => void load(), 60_000)
})
onUnmounted(() => {
  clearTimeout(timer)
  clearInterval(interval)
  stops.forEach((stop) => stop())
})

function time(value: Date) {
  return value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.()
}
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Acompanhamento' }, { label: 'Painel ao vivo' }]">
    <LiveIndicator :extra="updatedAt ? `atualizado às ${time(updatedAt)}` : ''" />
    <button type="button" class="btn" @click="toggleFullscreen"><AppIcon name="monitor" :size="16" :stroke-width="1.8" />Tela cheia</button>
  </PageTopbar>

  <div class="page page--wide" style="gap: 28px">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Painel ao vivo</h1>
        <p class="page-subtitle">Situação dos chamados agora, {{ scopeText }}. Os números mudam sozinhos a cada evento.</p>
      </div>
    </div>

    <StateMessage v-if="error && !counts" state="error" :message="error" @retry="load" />
    <StateMessage v-else-if="loading && !counts" state="loading" />

    <template v-else-if="counts">
      <section aria-label="Indicadores" class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))">
        <div class="stat" style="padding: 20px; gap: 8px; border-radius: var(--radius-lg)">
          <span class="stat__label" style="display: flex; align-items: center; gap: 8px"><span class="tag tag--open tag--sm">Aberto</span>Chamados em aberto</span>
          <span class="stat__value stat__value--xl">{{ formatNumber(counts.OPEN) }}</span>
          <span class="small" style="color: var(--text-2)">aguardando alguém assumir</span>
        </div>
        <div class="stat" style="padding: 20px; gap: 8px; border-radius: var(--radius-lg)">
          <span class="stat__label" style="display: flex; align-items: center; gap: 8px"><span class="tag tag--progress tag--sm">Em andamento</span>Chamados em andamento</span>
          <span class="stat__value stat__value--xl">{{ formatNumber(counts.IN_PROGRESS) }}</span>
          <span class="small" style="color: var(--text-2)">{{ handlersBusy ? `com ${handlersBusy} ${handlersBusy === 1 ? 'atendente' : 'atendentes'}` : 'ninguém atendendo agora' }}</span>
        </div>
        <div class="stat" style="padding: 20px; gap: 8px; border-radius: var(--radius-lg)">
          <span class="stat__label">Total de chamados · {{ auth.isAdmin ? 'todos os setores' : 'do setor' }}</span>
          <span class="stat__value stat__value--xl">{{ formatNumber(counts.all) }}</span>
          <span class="small" style="color: var(--text-2)">{{ formatNumber(counts.CLOSED) }} encerrados</span>
        </div>
      </section>

      <div class="row-wrap" style="gap: 28px">
        <section aria-labelledby="por-setor" class="card" style="flex: 3 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 14px">
          <div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px">
            <h2 id="por-setor" class="section-title" style="flex: 1">{{ auth.isAdmin ? 'Chamados por setor' : 'Chamados por categoria' }}</h2>
            <span class="xsmall muted">{{ auth.isAdmin ? 'setor de quem abriu' : 'do seu setor' }} · últimos 12 meses</span>
          </div>
          <p v-if="!groups.length" class="small muted">Nenhum chamado no período.</p>
          <ol v-else class="bars">
            <li v-for="group in groups" :key="group.id">
              <span class="truncate" :title="group.label">{{ group.label }}</span>
              <span class="bar-track" aria-hidden="true"><span class="bar-fill" :style="{ width: `${(group.count / groupMax) * 100}%` }" /></span>
              <span class="num">{{ formatNumber(group.count) }}</span>
            </li>
          </ol>
        </section>

        <div style="flex: 2 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 28px">
          <section aria-labelledby="fila-prio" class="card" style="display: flex; flex-direction: column; gap: 14px">
            <h2 id="fila-prio" class="section-title">Em aberto, por prioridade</h2>
            <div v-if="queueTotal" class="stack" aria-hidden="true">
              <span v-for="item in queueByPriority" v-show="item.count" :key="item.id" :style="{ flex: item.count, background: PRIORITY_COLORS[item.id] ?? '#D6D5D1' }" />
            </div>
            <div v-else class="stack" aria-hidden="true"><span style="flex: 1; background: var(--surface-sunken)" /></div>
            <ul class="legend">
              <li v-for="item in queueByPriority" :key="item.id">
                <span aria-hidden="true" class="legend__swatch" :style="{ background: PRIORITY_COLORS[item.id] ?? '#D6D5D1' }" />{{ item.label }}
                <strong>{{ item.count }}</strong>
              </li>
            </ul>
          </section>

          <section aria-labelledby="eventos" style="display: flex; flex-direction: column; gap: 4px">
            <h2 id="eventos" class="section-title" style="margin-bottom: 6px">Agora há pouco</h2>
            <p v-if="!events.length" class="small muted">Os eventos aparecem aqui conforme acontecem.</p>
            <ol v-else aria-live="polite" class="events">
              <li v-for="event in events" :key="event.id"><span class="muted">{{ time(event.at) }}</span><span>{{ event.text }}</span></li>
            </ol>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bars li {
  display: grid;
  grid-template-columns: minmax(110px, 160px) minmax(0, 1fr) 56px;
  gap: 12px;
  align-items: center;
}
.num {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.stack {
  display: flex;
  height: 14px;
  border-radius: 4px;
  overflow: hidden;
  gap: 2px;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  font-size: 13px;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend strong {
  margin-left: auto;
  font-weight: 600;
}
.legend__swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.events {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
}
.events li {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.events li > span:first-child {
  flex: none;
  width: 44px;
}
</style>
