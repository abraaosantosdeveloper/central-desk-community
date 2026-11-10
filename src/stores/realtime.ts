import { defineStore } from 'pinia'
import { ref } from 'vue'
import { refreshSession } from '@/api/http'
import type { Comment, TicketSummary } from '@/api'

// Conexão em tempo real com a API (Server-Sent Events): uma por aba, aberta enquanto há login.

export type ConnectionState = 'offline' | 'connecting' | 'live' | 'reconnecting'

export type RealtimeEvents = {
  'comment.created': Comment
  'ticket.created': TicketSummary
  'session.ended': { reason: string }
  'queue.changed': {
    openCount: number
    ticketId: string | null
    reason: 'OPENED' | 'ASSIGNED' | 'CLOSED' | 'RETURNED'
  }
  'department-requests.changed': {
    pendingCount: number
    requestId: string
    reason: 'CREATED' | 'APPROVED' | 'REJECTED'
  }
}
type EventName = keyof RealtimeEvents
type Listener<E extends EventName> = (data: RealtimeEvents[E]) => void

const EVENT_NAMES: EventName[] = [
  'comment.created',
  'ticket.created',
  'session.ended',
  'queue.changed',
  'department-requests.changed',
]
const MAX_RETRY_DELAY_MS = 30_000

export const useRealtimeStore = defineStore('realtime', () => {
  const state = ref<ConnectionState>('offline')
  const listeners = new Map<EventName, Set<Listener<EventName>>>()
  const connectedListeners = new Set<() => void>()

  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retries = 0
  let wanted = false

  function emit<E extends EventName>(name: E, data: RealtimeEvents[E]) {
    listeners.get(name)?.forEach((listener) => (listener as Listener<E>)(data))
  }

  /** Registra um ouvinte e devolve a função que o remove (use no onUnmounted). */
  function on<E extends EventName>(name: E, listener: Listener<E>): () => void {
    if (!listeners.has(name)) listeners.set(name, new Set())
    listeners.get(name)!.add(listener as Listener<EventName>)
    return () => listeners.get(name)?.delete(listener as Listener<EventName>)
  }

  /** Chamado a cada "connected" (primeira conexão e reconexões): quem guarda estado busca tudo de novo. */
  function onConnected(listener: () => void): () => void {
    connectedListeners.add(listener)
    return () => connectedListeners.delete(listener)
  }

  function open() {
    source?.close()
    state.value = retries === 0 ? 'connecting' : 'reconnecting'
    source = new EventSource('/api/events/stream')

    source.addEventListener('connected', () => {
      retries = 0
      state.value = 'live'
      connectedListeners.forEach((listener) => listener())
    })
    for (const name of EVENT_NAMES) {
      source.addEventListener(name, (event) => {
        try {
          emit(name, JSON.parse((event as MessageEvent<string>).data))
        } catch {
          // Evento malformado: ignora, sem derrubar a conexão
        }
      })
    }
    // O EventSource não renova a sessão: quando a conexão cai, renovamos e reabrimos com espera crescente
    source.onerror = () => {
      source?.close()
      source = null
      if (!wanted) return
      state.value = 'reconnecting'
      const delay = Math.min(1000 * 2 ** retries, MAX_RETRY_DELAY_MS)
      retries++
      clearTimeout(retryTimer)
      retryTimer = setTimeout(async () => {
        if (!wanted) return
        await refreshSession()
        if (wanted) open()
      }, delay)
    }
  }

  function connect() {
    if (wanted) return
    wanted = true
    retries = 0
    open()
  }

  function disconnect() {
    wanted = false
    clearTimeout(retryTimer)
    source?.close()
    source = null
    state.value = 'offline'
  }

  return { state, on, onConnected, connect, disconnect }
})
