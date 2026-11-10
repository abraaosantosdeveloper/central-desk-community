import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { IconName } from '@/components/AppIcon.vue'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCountersStore } from '@/stores/counters'

// Fonte única dos itens do menu: a barra lateral e a gaveta do celular desenham a mesma lista.
// Quem aparece depende do perfil; quem barra de verdade é a API.

export interface NavItem {
  key: string
  label: string
  to: RouteLocationRaw
  icon: IconName
  /** Contador ao lado do item. `badge`: destaque azul (pede ação); `count`: só informa. */
  count?: number
  badge?: boolean
  countLabel?: string
}

export interface NavSection {
  key: string
  title?: string
  items: NavItem[]
}

export function useNavigation() {
  const auth = useAuthStore()
  const counters = useCountersStore()
  const activity = useActivityStore()

  const sections = computed<NavSection[]>(() => {
    const result: NavSection[] = [
      {
        key: 'general',
        items: [
          { key: 'home', label: 'Início', to: { name: 'home' }, icon: 'home' },
          {
            key: 'activity',
            label: 'Notificações',
            to: { name: 'activity' },
            icon: 'bell',
            count: activity.unread,
            badge: true,
            countLabel: `${activity.unread} não lidas`,
          },
          { key: 'new-ticket', label: 'Novo chamado', to: { name: 'new-ticket' }, icon: 'plus' },
          { key: 'mine', label: 'Meus chamados', to: { name: 'mine' }, icon: 'doc' },
        ],
      },
    ]

    if (auth.canHandleTickets) {
      result.push({
        key: 'attendance',
        title: 'Atendimento',
        items: [
          {
            key: 'queue',
            label: 'Fila de atendimento',
            to: { name: 'queue' },
            icon: 'inbox',
            count: counters.queueOpen,
            countLabel: `${counters.queueOpen} na fila`,
          },
          { key: 'board', label: 'Meus atendimentos', to: { name: 'board' }, icon: 'board' },
        ],
      })
    }

    if (auth.canBrowseAllTickets) {
      result.push({
        key: 'tracking',
        title: 'Acompanhamento',
        items: [
          {
            key: 'all-tickets',
            label: auth.isAdmin ? 'Todos os chamados' : 'Chamados do setor',
            to: { name: 'all-tickets' },
            icon: 'layers',
          },
          { key: 'live', label: 'Painel ao vivo', to: { name: 'live' }, icon: 'pulse' },
          { key: 'metrics', label: 'Métricas', to: { name: 'metrics' }, icon: 'chart' },
        ],
      })
    }

    if (auth.isAdmin) {
      result.push({
        key: 'admin',
        title: 'Administração',
        items: [
          { key: 'users', label: 'Usuários', to: { name: 'users' }, icon: 'users' },
          {
            key: 'approvals',
            label: 'Aprovações',
            to: { name: 'approvals' },
            icon: 'approve',
            count: counters.pendingApprovals,
            badge: true,
            countLabel: `${counters.pendingApprovals} pendentes`,
          },
          { key: 'categories', label: 'Categorias', to: { name: 'categories' }, icon: 'tag' },
        ],
      })
    }

    return result
  })

  return { sections }
}
