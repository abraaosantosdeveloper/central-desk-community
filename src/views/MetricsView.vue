<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { dashboardApi, errorMessage, ticketsApi, type Metrics, type MetricsSummary } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import StateMessage from '@/components/StateMessage.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useToastsStore } from '@/stores/toasts'
import { daysAgo, formatAgo, formatNumber, formatSeconds, isoDay } from '@/utils/format'
import { saveFile } from '@/utils/saveFile'

// Métricas do atendimento. Administrador: todos os setores (com filtro de setor de origem);
// coordenador: só o próprio setor, travado pela API.

const auth = useAuthStore()
const catalog = useCatalogStore()
const toasts = useToastsStore()

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '12 meses' },
]

const periodDays = ref(30)
const sectorId = ref('')
const metrics = ref<Metrics | null>(null)
const loading = ref(true)
const error = ref('')
const exporting = ref(false)

const departments = computed(() => [...catalog.departments].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))

async function load() {
  loading.value = true
  error.value = ''
  try {
    metrics.value = await dashboardApi.metrics({
      from: isoDay(daysAgo(periodDays.value - 1)),
      to: isoDay(new Date()),
      originDepartmentId: auth.isAdmin ? sectorId.value || undefined : undefined,
    })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

watch([periodDays, sectorId], () => void load())
onMounted(() => {
  void load()
  if (auth.isAdmin) void catalog.loadDepartments().catch(() => undefined)
})

/** Comparação com o período anterior: texto e se a mudança é boa. */
function compare(current: number | null, previous: number | null, lowerIsBetter: boolean) {
  if (current === null || previous === null || previous === 0) return null
  const diff = current - previous
  if (Math.abs(diff) < 60) return { text: 'igual ao período anterior', good: true }
  const better = lowerIsBetter ? diff < 0 : diff > 0
  return { text: `${formatSeconds(Math.abs(diff))} ${diff < 0 ? 'mais rápido' : 'mais lento'} que o período anterior`, good: better }
}

const summary = computed<MetricsSummary | null>(() => metrics.value?.summary ?? null)
const responseCompare = computed(() =>
  metrics.value ? compare(metrics.value.summary.avgResponseSeconds, metrics.value.previousSummary.avgResponseSeconds, true) : null,
)
const resolutionCompare = computed(() =>
  metrics.value ? compare(metrics.value.summary.avgResolutionSeconds, metrics.value.previousSummary.avgResolutionSeconds, true) : null,
)

/** Colunas do gráfico: por dia até 31 dias; acima disso, somadas por semana. */
const series = computed(() => {
  const days = metrics.value?.perDay ?? []
  if (days.length <= 31) {
    return days.map((day) => ({ label: shortDate(day.date), opened: day.opened, closed: day.closed }))
  }
  const weeks: { label: string; opened: number; closed: number }[] = []
  days.forEach((day, index) => {
    if (index % 7 === 0) weeks.push({ label: shortDate(day.date), opened: 0, closed: 0 })
    const week = weeks[weeks.length - 1]!
    week.opened += day.opened
    week.closed += day.closed
  })
  return weeks
})
const chartMax = computed(() => Math.max(1, ...series.value.flatMap((item) => [item.opened, item.closed])))
const labelEvery = computed(() => Math.max(1, Math.ceil(series.value.length / 10)))
const chartDescription = computed(() => {
  const opened = series.value.reduce((sum, item) => sum + item.opened, 0)
  const closed = series.value.reduce((sum, item) => sum + item.closed, 0)
  return `Gráfico de colunas: ${opened} chamados abertos e ${closed} encerrados no período, ${series.value.length > 31 ? 'por semana' : 'por dia'}.`
})

function shortDate(iso: string) {
  const [, month, day] = iso.split('-')
  return `${Number(day)}/${Number(month)}`
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
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Acompanhamento' }, { label: 'Métricas' }]">
    <button type="button" class="btn" :disabled="exporting" @click="exportSpreadsheet">
      <AppIcon name="download" :size="16" :stroke-width="1.8" />{{ exporting ? 'Gerando…' : 'Exportar planilha' }}
    </button>
  </PageTopbar>

  <div class="page page--wide" style="gap: 28px">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Métricas</h1>
        <p class="page-subtitle">
          Desempenho do atendimento de {{ SUPPORT_TEAM_NAME }}<template v-if="metrics?.sector"> para chamados de {{ metrics.sector.name }}</template>.
        </p>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <template v-if="auth.isAdmin">
          <label for="m-setor" class="sr-only">Setor de origem</label>
          <select id="m-setor" v-model="sectorId" class="pill" :class="{ 'is-set': sectorId }">
            <option value="">Todos os setores</option>
            <option v-for="department in departments" :key="department.id" :value="department.id">{{ department.name }}</option>
          </select>
        </template>
        <div class="segmented" role="tablist" aria-label="Período">
          <button v-for="period in PERIODS" :key="period.days" type="button" role="tab" :aria-selected="periodDays === period.days" @click="periodDays = period.days">{{ period.label }}</button>
        </div>
      </div>
    </div>

    <StateMessage v-if="error" state="error" :message="error" @retry="load" />
    <StateMessage v-else-if="loading && !metrics" state="loading" />

    <template v-else-if="metrics && summary">
      <section aria-label="Indicadores do período" class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); opacity: 1" :style="{ opacity: loading ? 0.6 : 1 }">
        <div class="stat" style="padding: 18px; gap: 6px; border-radius: var(--radius-lg)">
          <span class="stat__label">Tempo médio de resposta</span>
          <span class="stat__value stat__value--lg">{{ formatSeconds(summary.avgResponseSeconds) }}</span>
          <span class="stat__note" :class="{ 'stat__note--good': responseCompare?.good, 'stat__note--danger': responseCompare && !responseCompare.good }">{{ responseCompare?.text ?? 'da abertura até alguém assumir' }}</span>
        </div>
        <div class="stat" style="padding: 18px; gap: 6px; border-radius: var(--radius-lg)">
          <span class="stat__label">Tempo médio de resolução</span>
          <span class="stat__value stat__value--lg">{{ formatSeconds(summary.avgResolutionSeconds) }}</span>
          <span class="stat__note" :class="{ 'stat__note--good': resolutionCompare?.good, 'stat__note--danger': resolutionCompare && !resolutionCompare.good }">{{ resolutionCompare?.text ?? 'da abertura ao encerramento' }}</span>
        </div>
        <div class="stat" style="padding: 18px; gap: 6px; border-radius: var(--radius-lg)">
          <span class="stat__label">Encerrados</span>
          <span class="stat__value stat__value--lg">{{ formatNumber(summary.closed) }}</span>
          <span class="stat__note">{{ summary.reopened }} {{ summary.reopened === 1 ? 'reaberto' : 'reabertos' }}<template v-if="summary.closed"> ({{ Math.round((summary.reopened / summary.closed) * 100) }}%)</template></span>
        </div>
        <div class="stat" style="padding: 18px; gap: 6px; border-radius: var(--radius-lg)">
          <span class="stat__label">Abertos no período</span>
          <span class="stat__value stat__value--lg">{{ formatNumber(summary.total) }}</span>
          <span class="stat__note">{{ summary.taken }} assumidos · {{ metrics.now.unassigned }} sem responsável agora</span>
        </div>
      </section>

      <section aria-labelledby="grafico" class="card" style="display: flex; flex-direction: column; gap: 16px">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">
          <h2 id="grafico" class="section-title" style="flex: 1">Abertos e encerrados {{ series.length > 31 || periodDays > 31 ? 'por semana' : 'por dia' }}</h2>
          <span class="legend-item"><span class="legend-swatch" style="background: var(--accent)" />Abertos</span>
          <span class="legend-item"><span class="legend-swatch" style="background: var(--chart-2)" />Encerrados</span>
        </div>
        <div class="table-scroll">
          <div role="img" :aria-label="chartDescription" class="chart" :style="{ '--n': series.length }">
            <div class="chart__axis"><span>{{ chartMax }}</span><span>{{ Math.round(chartMax / 2) }}</span><span>0</span></div>
            <div v-for="(item, index) in series" :key="index" class="chart__col" :title="`${item.label}: ${item.opened} abertos, ${item.closed} encerrados`">
              <span :style="{ height: `${(item.opened / chartMax) * 100}%`, background: 'var(--accent)' }" />
              <span :style="{ height: `${(item.closed / chartMax) * 100}%`, background: 'var(--chart-2)' }" />
            </div>
            <span />
            <span v-for="(item, index) in series" :key="`l${index}`" class="chart__label">{{ index % labelEvery === 0 ? item.label : '' }}</span>
          </div>
        </div>
      </section>

      <div class="row-wrap" style="gap: 28px">
        <section aria-labelledby="por-cat" style="flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
          <h2 id="por-cat" class="section-title">Por categoria</h2>
          <p v-if="!metrics.byCategory.length" class="small muted">Sem chamados no período.</p>
          <div v-else class="table-scroll">
            <table class="table" style="min-width: 360px">
              <thead><tr><th scope="col">Categoria</th><th scope="col" class="num">Chamados</th><th scope="col" class="num">Resolução média</th></tr></thead>
              <tbody>
                <tr v-for="group in metrics.byCategory" :key="group.id">
                  <td>{{ group.label }}</td>
                  <td class="num">{{ formatNumber(group.count) }}</td>
                  <td class="num">{{ formatSeconds(group.avgResolutionSeconds) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="por-atend" style="flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
          <h2 id="por-atend" class="section-title">Por atendente</h2>
          <p v-if="!metrics.byAssignee.length" class="small muted">Ninguém atendeu no período.</p>
          <div v-else class="table-scroll">
            <table class="table" style="min-width: 420px">
              <thead><tr><th scope="col">Pessoa</th><th scope="col" class="num">Em andamento</th><th scope="col" class="num">Encerrados</th><th scope="col" class="num">Resposta média</th></tr></thead>
              <tbody>
                <tr v-for="person in metrics.byAssignee" :key="person.id">
                  <td>{{ person.name }}</td>
                  <td class="num">{{ person.inProgress }}</td>
                  <td class="num">{{ person.closed }}</td>
                  <td class="num">{{ formatSeconds(person.avgResponseSeconds) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section v-if="metrics.oldestUnassigned.length" aria-labelledby="mais-antigos" style="display: flex; flex-direction: column; gap: 8px">
        <h2 id="mais-antigos" class="section-title">Esperando há mais tempo</h2>
        <div class="list-rows">
          <div v-for="ticket in metrics.oldestUnassigned" :key="ticket.id" class="list-row">
            <span class="cell-muted" style="width: 56px">#{{ ticket.number }}</span>
            <RouterLink :to="{ name: 'ticket', params: { id: ticket.id } }" style="flex: 1 1 220px; min-width: 0; color: var(--text); text-decoration: none; font-weight: 500" class="truncate">{{ ticket.title }}</RouterLink>
            <span class="small muted">{{ ticket.requesterName }} · {{ ticket.requesterDepartment }}</span>
            <span class="small" style="color: var(--danger-text); font-weight: 500">na fila {{ formatAgo(ticket.createdAt) }}</span>
          </div>
        </div>
      </section>

      <p class="xsmall muted">Período de {{ metrics.period.from.split('-').reverse().join('/') }} a {{ metrics.period.to.split('-').reverse().join('/') }}, comparado com os {{ periodDays }} dias anteriores.</p>
    </template>
  </div>
</template>

<style scoped>
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}
.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.chart {
  min-width: max(560px, calc(var(--n) * 22px));
  display: grid;
  grid-template-columns: 32px repeat(var(--n), minmax(0, 1fr));
  column-gap: 6px;
}
.chart__axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 170px;
  font-size: 11px;
  color: var(--muted);
  text-align: right;
}
.chart__col {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  height: 170px;
  border-bottom: 1px solid var(--border-strong);
  background: linear-gradient(var(--surface-sunken), var(--surface-sunken)) 0 85px / 100% 1px no-repeat;
}
.chart__col span {
  width: min(14px, 40%);
  min-height: 0;
  border-radius: 2px 2px 0 0;
}
.chart__label {
  padding-top: 6px;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  white-space: nowrap;
}
</style>
