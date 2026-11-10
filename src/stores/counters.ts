import { defineStore } from 'pinia'
import { ref } from 'vue'
import { departmentRequestsApi, ticketsApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'

// Contadores do menu: tamanho da fila e pedidos de entrada pendentes. A API manda a contagem
// pronta (queue.changed, department-requests.changed) e aqui só se substitui o valor.

export const useCountersStore = defineStore('counters', () => {
  const queueOpen = ref(0)
  const pendingApprovals = ref(0)

  let stops: (() => void)[] = []

  async function sync() {
    const auth = useAuthStore()
    const [queue, approvals] = await Promise.allSettled([
      auth.canHandleTickets ? ticketsApi.queueCount() : Promise.resolve({ openCount: 0 }),
      auth.isAdmin ? departmentRequestsApi.listPending() : Promise.resolve([]),
    ])
    if (queue.status === 'fulfilled') queueOpen.value = queue.value.openCount
    if (approvals.status === 'fulfilled') pendingApprovals.value = approvals.value.length
  }

  function start() {
    stop()
    const realtime = useRealtimeStore()
    stops = [
      realtime.onConnected(() => void sync()),
      realtime.on('queue.changed', (event) => {
        queueOpen.value = event.openCount
      }),
      realtime.on('department-requests.changed', (event) => {
        pendingApprovals.value = event.pendingCount
      }),
    ]
    void sync()
  }

  function stop() {
    stops.forEach((off) => off())
    stops = []
  }

  function reset() {
    stop()
    queueOpen.value = 0
    pendingApprovals.value = 0
  }

  return { queueOpen, pendingApprovals, sync, start, stop, reset }
})
