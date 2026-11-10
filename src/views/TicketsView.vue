<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  errorMessage,
  ticketsApi,
  type OverviewAssignee,
  type OverviewOrder,
  type SectorRelation,
  type StatusCounts,
  type TicketStatus,
  type TicketSummary,
} from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import CategoryLabel from '@/components/CategoryLabel.vue'
import LiveIndicator from '@/components/LiveIndicator.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import PriorityLabel from '@/components/PriorityLabel.vue'
import StateMessage from '@/components/StateMessage.vue'
import StatusTag from '@/components/StatusTag.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useDebounced } from '@/composables/useDebounced'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useRealtimeStore } from '@/stores/realtime'
import { useToastsStore } from '@/stores/toasts'
import { formatAgo, formatWaitingShort } from '@/utils/format'
import { saveFile } from '@/utils/saveFile'
import { STATUS_LABELS, ticketCode } from '@/utils/ticket'

// "Chamados": uma base de dados com visualizações (abas). Fila de atendimento, meus chamados e
// todos os chamados (administrador) ou os do setor (coordenador). "Meus atendimentos" abre o quadro.

type Kind = 'queue' | 'mine' | 'all'
const props = defineProps<{ kind: Kind }>()

const auth = useAuthStore()
const catalog = useCatalogStore()
const activity = useActivityStore()
const realtime = useRealtimeStore()
const toasts = useToastsStore()
const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 20

const tickets = ref<TicketSummary[]>([])
const page = ref(0)
const totalPages = ref(0)
const totalElements = ref(0)
const statusCounts = ref<StatusCounts | null>(null)
const loading = ref(true)
const error = ref('')
const assigningId = ref<string | null>(null)
const exporting = ref(false)
const overviewAssignees = ref<OverviewAssignee[]>([])

const search = ref('')
const debouncedSearch = useDebounced(search)
const status = ref<TicketStatus | ''>(
  typeof route.query.status === 'string' ? (route.query.status as TicketStatus) : '',
)
const categoryId = ref('')
const priorityId = ref('')
const departmentId = ref('')
const relation = ref<SectorRelation>('BOTH')
const assigneeFilter = ref('')
const orderBy = ref<OverviewOrder>(props.kind === 'queue' ? 'PRIORITY' : 'RECENT')

const searchInput = ref<HTMLInputElement | null>(null)

const allLabel = computed(() => (auth.isAdmin ? 'Todos os chamados' : 'Chamados do setor'))
const pageTitle = computed(() => (props.kind === 'all' ? allLabel.value : 'Chamados'))
const subtitle = computed(() => {
  if (props.kind === 'all') {
    return auth.isAdmin
      ? 'Todos os chamados, de todos os setores, em qualquer situação.'
      : `Os chamados que ${auth.currentUser?.departmentName ?? 'o seu setor'} abriu ou recebeu.`
  }
  return `Pedidos de suporte de todos os setores, destinados a ${SUPPORT_TEAM_NAME}.`
})
const crumb = computed(() =>
  props.kind === 'queue' ? 'Fila de atendimento' : props.kind === 'mine' ? 'Meus chamados' : allLabel.value,
)

const columns = computed(() => {
  if (props.kind === 'queue') return '64px minmax(220px, 1fr) 160px 100px 200px 84px 132px'
  if (props.kind === 'mine') return '64px minmax(220px, 1fr) 128px 100px 160px 180px 96px'
  return '64px minmax(220px, 1fr) 128px 100px 230px 170px 96px'
})

const departments = computed(() =>
  [...catalog.departments].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
)

async function load() {
  loading.value = true
  error.value = ''
  const common = {
    q: debouncedSearch.value.trim() || undefined,
    categoryId: categoryId.value || undefined,
    priorityId: priorityId.value ? Number(priorityId.value) : undefined,
    page: page.value,
    size: PAGE_SIZE,
  }
  try {
    if (props.kind === 'all') {
      const result = await ticketsApi.overview({
        ...common,
        status: status.value || undefined,
        originDepartmentId: auth.isAdmin ? departmentId.value || undefined : undefined,
        relation: auth.isAdmin ? undefined : relation.value,
        assigneeId: assigneeFilter.value && assigneeFilter.value !== 'none' ? assigneeFilter.value : undefined,
        unassigned: assigneeFilter.value === 'none' ? true : undefined,
        orderBy: orderBy.value,
      })
      tickets.value = result.content
      totalPages.value = result.totalPages
      totalElements.value = result.totalElements
      statusCounts.value = result.statusCounts
    } else {
      const result = await ticketsApi.list(props.kind, {
        ...common,
        status: props.kind === 'mine' ? status.value || undefined : undefined,
        departmentId: departmentId.value || undefined,
        orderBy: orderBy.value === 'UPDATED' ? 'RECENT' : orderBy.value,
      })
      tickets.value = result.content
      totalPages.value = result.totalPages
      totalElements.value = result.totalElements
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

watch([debouncedSearch, status, categoryId, priorityId, departmentId, relation, assigneeFilter, orderBy], () => {
  page.value = 0
  void load()
})

function changePage(next: number) {
  page.value = next
  void load()
}

let reloadTimer: ReturnType<typeof setTimeout> | undefined
function scheduleReload() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => void load(), 500)
}

const stops: (() => void)[] = []
onMounted(async () => {
  void catalog.loadTicketOptions().catch(() => undefined)
  void catalog.loadDepartments().catch(() => undefined)
  if (props.kind === 'all') {
    ticketsApi.overviewAssignees().then((list) => (overviewAssignees.value = list), () => undefined)
  }
  await load()
  if (props.kind !== 'mine') {
    stops.push(realtime.on('queue.changed', scheduleReload), realtime.on('ticket.created', scheduleReload))
  }
  stops.push(realtime.onConnected(scheduleReload))
  if (route.query.busca) {
    await nextTick()
    searchInput.value?.focus()
    void router.replace({ query: { ...route.query, busca: undefined } })
  }
})
onUnmounted(() => {
  clearTimeout(reloadTimer)
  stops.forEach((stop) => stop())
})

function isOwn(ticket: TicketSummary) {
  return ticket.requesterId === auth.currentUser?.id
}

function canAssume(ticket: TicketSummary) {
  return !isOwn(ticket) || auth.canTakeOwnTickets
}

async function assume(ticket: TicketSummary) {
  if (assigningId.value) return
  assigningId.value = ticket.id
  try {
    await ticketsApi.assign(ticket.id)
    activity.forgetNew(ticket.id)
    toasts.success(`Você assumiu ${ticketCode(ticket)}.`)
    await router.push({ name: 'ticket', params: { id: ticket.id } })
  } catch (err) {
    toasts.error(errorMessage(err))
    void load()
  } finally {
    assigningId.value = null
  }
}

async function exportSpreadsheet() {
  if (exporting.value) return
  exporting.value = true
  try {
    const file = await ticketsApi.exportSpreadsheet()
    saveFile(file.blob, file.fileName || 'chamados.xlsx')
    toasts.success('Planilha baixada.')
  } catch (err) {
    toasts.error(errorMessage(err))
  } finally {
    exporting.value = false
  }
}

const summary = computed(() => {
  if (props.kind === 'queue') {
    return `${totalElements.value} ${totalElements.value === 1 ? 'chamado' : 'chamados'} na fila${orderBy.value === 'PRIORITY' ? ' · ordenados por prioridade e, no empate, pelo mais antigo' : ''}`
  }
  return `${totalElements.value} ${totalElements.value === 1 ? 'chamado' : 'chamados'}`
})

const statusTabs = computed(() => {
  const counts = statusCounts.value
  return [
    { value: '' as const, label: 'Todos', count: counts?.all },
    { value: 'OPEN' as const, label: 'Abertos', count: counts?.OPEN },
    { value: 'IN_PROGRESS' as const, label: 'Em andamento', count: counts?.IN_PROGRESS },
    { value: 'CLOSED' as const, label: 'Encerrados', count: counts?.CLOSED },
  ]
})

const emptyMessage = computed(() => {
  const filtered = !!(debouncedSearch.value || status.value || categoryId.value || priorityId.value || departmentId.value || assigneeFilter.value)
  if (filtered) return 'Nenhum chamado com esses filtros.'
  if (props.kind === 'queue') return 'A fila está vazia. Chamados novos aparecem aqui na hora.'
  if (props.kind === 'mine') return 'Você ainda não abriu chamados.'
  return 'Nenhum chamado por aqui.'
})
</script>

<template>
  <PageTopbar :crumbs="[{ label: kind === 'all' ? 'Acompanhamento' : 'Chamados' }, { label: crumb }]">
    <LiveIndicator v-if="kind !== 'mine'" />
    <button v-if="kind === 'all'" type="button" class="btn" :disabled="exporting" @click="exportSpreadsheet">
      <AppIcon name="download" :size="16" :stroke-width="1.8" />{{ exporting ? 'Gerando…' : 'Exportar planilha' }}
    </button>
    <RouterLink :to="{ name: 'new-ticket' }" class="btn btn--primary">
      <AppIcon name="plus" :size="16" :stroke-width="2" />Novo chamado
    </RouterLink>
  </PageTopbar>

  <div class="page page--wide">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">{{ pageTitle }}</h1>
        <p class="page-subtitle">{{ subtitle }}</p>
      </div>
    </div>

    <nav class="tabs" aria-label="Visualizações">
      <template v-if="auth.canHandleTickets">
        <RouterLink :to="{ name: 'queue' }" class="tab" :class="{ 'is-active': kind === 'queue' }">
          <AppIcon name="table" :size="16" />Fila de atendimento
        </RouterLink>
        <RouterLink :to="{ name: 'board' }" class="tab">
          <AppIcon name="board" :size="16" />Meus atendimentos
        </RouterLink>
      </template>
      <RouterLink :to="{ name: 'mine' }" class="tab" :class="{ 'is-active': kind === 'mine' }">
        <AppIcon name="doc" :size="16" />Meus chamados
      </RouterLink>
      <RouterLink v-if="auth.canBrowseAllTickets" :to="{ name: 'all-tickets' }" class="tab" :class="{ 'is-active': kind === 'all' }">
        <AppIcon name="layers" :size="16" />{{ allLabel }}
      </RouterLink>
    </nav>

    <div v-if="kind === 'all'" class="segmented" role="tablist" aria-label="Situação" style="align-self: flex-start">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="status === tab.value"
        @click="status = tab.value"
      >
        {{ tab.label }}<span v-if="tab.count !== undefined" class="tab__count" style="margin-left: 6px">{{ tab.count }}</span>
      </button>
    </div>

    <div class="toolbar">
      <div class="input-with-icon toolbar__search">
        <label for="busca-chamados" class="sr-only">Buscar chamados</label>
        <AppIcon name="search" :size="16" :stroke-width="1.8" />
        <input id="busca-chamados" ref="searchInput" v-model="search" type="search" class="input" placeholder="Buscar por título ou #número" style="border-color: var(--border)">
      </div>

      <label class="sr-only" for="f-status">Situação</label>
      <select v-if="kind === 'mine'" id="f-status" v-model="status" class="pill" :class="{ 'is-set': status }">
        <option value="">Situação</option>
        <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">{{ label }}</option>
      </select>

      <label class="sr-only" for="f-categoria">Categoria</label>
      <select id="f-categoria" v-model="categoryId" class="pill" :class="{ 'is-set': categoryId }">
        <option value="">Categoria</option>
        <option v-for="category in catalog.categories" :key="category.id" :value="category.id">{{ category.label }}</option>
      </select>

      <label class="sr-only" for="f-prioridade">Prioridade</label>
      <select id="f-prioridade" v-model="priorityId" class="pill" :class="{ 'is-set': priorityId }">
        <option value="">Prioridade</option>
        <option v-for="priority in catalog.priorities" :key="priority.id" :value="String(priority.id)">{{ priority.label }}</option>
      </select>

      <template v-if="kind !== 'all' || auth.isAdmin">
        <label class="sr-only" for="f-depto">{{ kind === 'all' ? 'Setor de origem' : 'Departamento de quem abriu' }}</label>
        <select id="f-depto" v-model="departmentId" class="pill" :class="{ 'is-set': departmentId }">
          <option value="">{{ kind === 'all' ? 'Setor de origem' : 'Departamento' }}</option>
          <option v-for="department in departments" :key="department.id" :value="department.id">{{ department.name }}</option>
        </select>
      </template>
      <template v-else>
        <label class="sr-only" for="f-relacao">Relação com o setor</label>
        <select id="f-relacao" v-model="relation" class="pill" :class="{ 'is-set': relation !== 'BOTH' }">
          <option value="BOTH">Abertos ou recebidos</option>
          <option value="ORIGIN">Abertos pelo setor</option>
          <option value="TARGET">Recebidos pelo setor</option>
        </select>
      </template>

      <template v-if="kind === 'all'">
        <label class="sr-only" for="f-responsavel">Responsável</label>
        <select id="f-responsavel" v-model="assigneeFilter" class="pill" :class="{ 'is-set': assigneeFilter }">
          <option value="">Responsável</option>
          <option value="none">Sem responsável</option>
          <option v-for="person in overviewAssignees" :key="person.id" :value="person.id">{{ person.fullName }}</option>
        </select>
      </template>

      <span class="toolbar__spacer" />
      <label class="sr-only" for="f-ordem">Ordenar</label>
      <select id="f-ordem" v-model="orderBy" class="pill" style="border-color: transparent">
        <option value="RECENT">Mais recentes primeiro</option>
        <option value="PRIORITY">Mais urgentes primeiro</option>
        <option v-if="kind === 'all'" value="UPDATED">Atualizados recentemente</option>
      </select>
    </div>

    <StateMessage v-if="error" state="error" :message="error" @retry="load" />
    <StateMessage v-else-if="loading && !tickets.length" state="loading" />
    <StateMessage v-else-if="!tickets.length" state="empty" :message="emptyMessage">
      <RouterLink v-if="kind === 'mine'" :to="{ name: 'new-ticket' }" class="btn btn--sm">Abrir chamado</RouterLink>
    </StateMessage>

    <div v-else class="table-scroll" :aria-busy="loading">
      <div role="table" :aria-label="crumb" class="db-table" style="--table-min: 1000px" :style="{ '--cols': columns }">
        <div role="row" class="db-row db-row--head">
          <span role="columnheader">Nº</span>
          <span role="columnheader">Título</span>
          <template v-if="kind === 'queue'">
            <span role="columnheader">Categoria</span>
            <span role="columnheader">Prioridade</span>
            <span role="columnheader">Solicitante</span>
            <span role="columnheader">Na fila</span>
            <span role="columnheader"><span class="sr-only">Ação</span></span>
          </template>
          <template v-else-if="kind === 'mine'">
            <span role="columnheader">Situação</span>
            <span role="columnheader">Prioridade</span>
            <span role="columnheader">Categoria</span>
            <span role="columnheader">Responsável</span>
            <span role="columnheader">Atualizado</span>
          </template>
          <template v-else>
            <span role="columnheader">Situação</span>
            <span role="columnheader">Prioridade</span>
            <span role="columnheader">Origem → destino</span>
            <span role="columnheader">Responsável</span>
            <span role="columnheader">Aberto</span>
          </template>
        </div>

        <div
          v-for="ticket in tickets"
          :key="ticket.id"
          role="row"
          class="db-row db-row--hover"
          :class="{ 'is-new': activity.newTicketIds.has(ticket.id) && ticket.status === 'OPEN' }"
        >
          <span role="cell" class="cell-muted">{{ ticketCode(ticket) }}</span>
          <span role="cell" class="db-cell-title">
            <RouterLink :to="{ name: 'ticket', params: { id: ticket.id } }" class="truncate" :title="ticket.title" @click="activity.forgetNew(ticket.id)">{{ ticket.title }}</RouterLink>
            <span v-if="activity.newTicketIds.has(ticket.id) && ticket.status === 'OPEN'" class="tag tag--new">NOVO</span>
          </span>

          <template v-if="kind === 'queue'">
            <span role="cell" style="min-width: 0"><CategoryLabel :category="ticket.category" /></span>
            <span role="cell"><PriorityLabel :priority="ticket.priority" /></span>
            <span role="cell" class="db-cell-stack">
              <span class="truncate">{{ ticket.requesterName }}{{ isOwn(ticket) ? ' (você)' : '' }}</span>
              <span class="xsmall muted truncate">{{ ticket.originDepartment?.name ?? '—' }}</span>
            </span>
            <span role="cell" class="cell-muted">{{ formatWaitingShort(ticket.createdAt) }}</span>
            <span role="cell">
              <button
                v-if="canAssume(ticket)"
                type="button"
                class="btn btn--sm"
                style="font-weight: 600"
                :disabled="assigningId !== null"
                :aria-label="`Assumir ${ticketCode(ticket)}`"
                @click="assume(ticket)"
              >
                {{ assigningId === ticket.id ? 'Assumindo…' : 'Assumir' }}
              </button>
              <span v-else class="xsmall muted">Aberto por você</span>
            </span>
          </template>

          <template v-else-if="kind === 'mine'">
            <span role="cell"><StatusTag :status="ticket.status" /></span>
            <span role="cell"><PriorityLabel :priority="ticket.priority" /></span>
            <span role="cell" style="min-width: 0"><CategoryLabel :category="ticket.category" /></span>
            <span role="cell" class="truncate small" :class="{ muted: !ticket.assigneeName }">{{ ticket.assigneeName ?? 'Na fila' }}</span>
            <span role="cell" class="cell-muted">{{ formatAgo(ticket.updatedAt ?? ticket.createdAt) }}</span>
          </template>

          <template v-else>
            <span role="cell"><StatusTag :status="ticket.status" /></span>
            <span role="cell"><PriorityLabel :priority="ticket.priority" /></span>
            <span role="cell" class="db-cell-stack">
              <span class="truncate">{{ ticket.originDepartment?.name ?? '—' }} → {{ ticket.targetDepartment?.name ?? '—' }}</span>
              <span class="xsmall muted truncate">{{ ticket.requesterName }}</span>
            </span>
            <span role="cell" class="truncate small" :class="{ muted: !ticket.assigneeName }">{{ ticket.assigneeName ?? 'Sem responsável' }}</span>
            <span role="cell" class="cell-muted">{{ formatAgo(ticket.createdAt) }}</span>
          </template>
        </div>
      </div>
    </div>

    <PaginationBar v-if="tickets.length" :page="page" :total-pages="totalPages" :summary="summary" @change="changePage" />
  </div>
</template>
