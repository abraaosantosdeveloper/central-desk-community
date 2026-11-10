<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { departmentRequestsApi, errorMessage, type DepartmentRequest } from '@/api'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LiveIndicator from '@/components/LiveIndicator.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import StateMessage from '@/components/StateMessage.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useCountersStore } from '@/stores/counters'
import { useRealtimeStore } from '@/stores/realtime'
import { useToastsStore } from '@/stores/toasts'
import { formatShortTime } from '@/utils/format'

// Pedidos de entrada no setor de atendimento. Aprovado: a pessoa passa a atender chamados.
// Recusado: continua no departamento Geral e pode pedir de novo.

const realtime = useRealtimeStore()
const counters = useCountersStore()
const toasts = useToastsStore()

const requests = ref<DepartmentRequest[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)
const rejecting = ref<DepartmentRequest | null>(null)
/** Decisões tomadas nesta visita (a API não lista o histórico). */
const decided = ref<{ request: DepartmentRequest; approved: boolean }[]>([])

async function load() {
  error.value = ''
  try {
    requests.value = await departmentRequestsApi.listPending()
    counters.pendingApprovals = requests.value.length
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

const stops: (() => void)[] = []
onMounted(() => {
  void load()
  stops.push(realtime.on('department-requests.changed', () => void load()), realtime.onConnected(() => void load()))
})
onUnmounted(() => stops.forEach((stop) => stop()))

async function decide(request: DepartmentRequest, approve: boolean) {
  if (busyId.value) return
  busyId.value = request.id
  try {
    if (approve) await departmentRequestsApi.approve(request.id)
    else await departmentRequestsApi.reject(request.id)
    decided.value = [{ request, approved: approve }, ...decided.value]
    toasts.success(approve ? `${request.userName} agora faz parte de ${request.departmentName}.` : `Pedido de ${request.userName} recusado.`)
    rejecting.value = null
  } catch (err) {
    toasts.error(errorMessage(err))
  } finally {
    busyId.value = null
    void load()
  }
}
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Administração' }, { label: 'Aprovações' }]">
    <LiveIndicator />
  </PageTopbar>

  <div class="page page--narrow">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Aprovações</h1>
        <p class="page-subtitle">Pedidos para entrar em {{ SUPPORT_TEAM_NAME }}. Quem é aprovado passa a atender chamados; quem é recusado continua no departamento Geral.</p>
      </div>
    </div>

    <div class="tabs" style="pointer-events: none">
      <span class="tab is-active">Pendentes <span class="tab__count">{{ requests.length }}</span></span>
    </div>

    <StateMessage v-if="error" state="error" :message="error" @retry="load" />
    <StateMessage v-else-if="loading" state="loading" />
    <StateMessage v-else-if="!requests.length" state="empty" message="Nenhum pedido aguardando. Pedidos novos aparecem aqui na hora." />

    <ol v-else class="requests">
      <li v-for="request in requests" :key="request.id">
        <UserAvatar :name="request.userName" :size="40" />
        <div style="flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 2px">
          <span style="font-weight: 600">{{ request.userName }}</span>
          <span class="small muted truncate">{{ request.userEmail }}</span>
          <span class="small" style="color: var(--text-2)">
            Pediu <strong style="font-weight: 600">{{ request.departmentName }}</strong> · {{ formatShortTime(request.createdAt) }}
          </span>
        </div>
        <div style="display: flex; gap: 8px">
          <button type="button" class="btn" :disabled="busyId !== null" @click="rejecting = request">Recusar</button>
          <button type="button" class="btn btn--primary" :disabled="busyId !== null" @click="decide(request, true)">
            {{ busyId === request.id ? 'Aprovando…' : 'Aprovar' }}
          </button>
        </div>
      </li>
    </ol>

    <section v-if="decided.length" aria-labelledby="recentes" style="display: flex; flex-direction: column; gap: 4px; margin-top: 12px">
      <h2 id="recentes" class="group-label" style="font-size: 13px; margin-bottom: 6px">Analisados agora há pouco</h2>
      <div class="list-rows">
        <div v-for="item in decided" :key="item.request.id" class="list-row">
          <span style="flex: 1 1 200px; font-weight: 500">{{ item.request.userName }}</span>
          <span class="tag" :class="item.approved ? 'tag--success' : 'tag--closed'">{{ item.approved ? 'Aprovado' : 'Recusado' }}</span>
        </div>
      </div>
    </section>
  </div>

  <ConfirmDialog
    :open="!!rejecting"
    :title="`Recusar o pedido de ${rejecting?.userName ?? ''}?`"
    description="A pessoa continua no departamento Geral e pode abrir chamados normalmente. Ela pode pedir de novo depois."
    confirm-label="Recusar pedido"
    :busy="busyId !== null"
    @confirm="rejecting && decide(rejecting, false)"
    @cancel="rejecting = null"
  />
</template>

<style scoped>
.requests {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.requests li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
</style>
