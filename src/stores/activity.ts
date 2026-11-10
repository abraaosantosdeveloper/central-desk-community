import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import { ticketCode } from '@/utils/ticket'

// Notificações desta sessão. A API ainda não guarda notificações (a tabela existe, os endpoints não),
// então a tela mostra o que chegou pelo tempo real desde que a aba foi aberta. Quando os endpoints
// de /notifications existirem, esta store passa a buscá-los e mantém a mesma interface.

export type ActivityCategory = 'TICKETS' | 'ADMINISTRATION'

export interface ActivityItem {
  id: number
  category: ActivityCategory
  /** Quem causou o evento (para o avatar); vazio = evento do sistema. */
  actor: string
  text: string
  /** Chamado ligado ao evento, para o link. */
  ticketId: string | null
  link: { name: string; params?: Record<string, string> } | null
  linkLabel: string
  at: string
  read: boolean
}

const MAX_ITEMS = 100

export const useActivityStore = defineStore('activity', () => {
  const items = ref<ActivityItem[]>([])
  /** Chamados que chegaram à fila nesta sessão: a lista mostra a etiqueta NOVO. */
  const newTicketIds = ref<Set<string>>(new Set())
  let nextId = 1
  let stops: (() => void)[] = []

  const unread = computed(() => items.value.filter((item) => !item.read).length)

  function push(item: Omit<ActivityItem, 'id' | 'read' | 'at'>) {
    items.value = [{ ...item, id: nextId++, read: false, at: new Date().toISOString() }, ...items.value].slice(
      0,
      MAX_ITEMS,
    )
  }

  function start() {
    stop()
    const realtime = useRealtimeStore()
    const auth = useAuthStore()
    stops = [
      realtime.on('ticket.created', (ticket) => {
        newTicketIds.value = new Set(newTicketIds.value).add(ticket.id)
        if (ticket.requesterId === auth.currentUser?.id) return
        push({
          category: 'TICKETS',
          actor: ticket.requesterName,
          text: `abriu ${ticketCode(ticket)} ${ticket.title}`,
          ticketId: ticket.id,
          link: { name: 'ticket', params: { id: ticket.id } },
          linkLabel: 'Ver chamado',
        })
      }),
      realtime.on('comment.created', (comment) => {
        if (comment.authorId === auth.currentUser?.id) return
        push({
          category: 'TICKETS',
          actor: comment.authorName,
          text: 'comentou em um chamado seu',
          ticketId: comment.ticketId,
          link: { name: 'ticket', params: { id: comment.ticketId } },
          linkLabel: 'Abrir conversa',
        })
      }),
      realtime.on('department-requests.changed', (event) => {
        if (event.reason !== 'CREATED') return
        push({
          category: 'ADMINISTRATION',
          actor: '',
          text: 'Novo pedido de entrada no setor de atendimento',
          ticketId: null,
          link: { name: 'approvals' },
          linkLabel: 'Revisar pedido',
        })
      }),
    ]
  }

  function stop() {
    stops.forEach((off) => off())
    stops = []
  }

  function markAllRead(category?: ActivityCategory) {
    items.value = items.value.map((item) =>
      !category || item.category === category ? { ...item, read: true } : item,
    )
  }

  function markRead(id: number) {
    items.value = items.value.map((item) => (item.id === id ? { ...item, read: true } : item))
  }

  function forgetNew(ticketId: string) {
    if (!newTicketIds.value.has(ticketId)) return
    const next = new Set(newTicketIds.value)
    next.delete(ticketId)
    newTicketIds.value = next
  }

  function reset() {
    stop()
    items.value = []
    newTicketIds.value = new Set()
  }

  return { items, unread, newTicketIds, start, stop, markAllRead, markRead, forgetNew, reset }
})
