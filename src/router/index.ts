import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'

// Quem vê o quê (a API aplica as mesmas regras; aqui é só para não mostrar telas inúteis):
// - colaborador: início, notificações, os próprios chamados, abrir chamado, perfil;
// - setor de atendimento (TICKET_HANDLER) e administradores: também a fila e os atendimentos;
// - coordenador: também "Chamados do setor", painel ao vivo e métricas do setor;
// - administrador: tudo, mais Usuários, Aprovações e Categorias.

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    handlerOnly?: boolean
    adminOnly?: boolean
    /** Administrador ou coordenador. */
    overviewOnly?: boolean
    title?: string
    /** Item do menu que fica aceso nesta tela. */
    navKey?: string
  }
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: 'Início' },
        },
        {
          path: 'notificacoes',
          name: 'activity',
          component: () => import('@/views/ActivityView.vue'),
          meta: { title: 'Notificações' },
        },
        {
          path: 'chamados',
          name: 'mine',
          component: () => import('@/views/TicketsView.vue'),
          props: { kind: 'mine' },
          meta: { title: 'Meus chamados' },
        },
        {
          path: 'fila',
          name: 'queue',
          component: () => import('@/views/TicketsView.vue'),
          props: { kind: 'queue' },
          meta: { handlerOnly: true, title: 'Fila de atendimento' },
        },
        {
          path: 'atendimentos',
          name: 'board',
          component: () => import('@/views/BoardView.vue'),
          meta: { handlerOnly: true, title: 'Meus atendimentos' },
        },
        {
          path: 'todos-os-chamados',
          name: 'all-tickets',
          component: () => import('@/views/TicketsView.vue'),
          props: { kind: 'all' },
          meta: { overviewOnly: true, title: 'Todos os chamados' },
        },
        {
          path: 'painel-ao-vivo',
          name: 'live',
          component: () => import('@/views/LiveView.vue'),
          meta: { overviewOnly: true, title: 'Painel ao vivo' },
        },
        {
          path: 'metricas',
          name: 'metrics',
          component: () => import('@/views/MetricsView.vue'),
          meta: { overviewOnly: true, title: 'Métricas' },
        },
        {
          path: 'chamados/novo',
          name: 'new-ticket',
          component: () => import('@/views/NewTicketView.vue'),
          meta: { title: 'Novo chamado' },
        },
        {
          path: `chamados/:id(${UUID})`,
          name: 'ticket',
          component: () => import('@/views/TicketDetailView.vue'),
          meta: { title: 'Chamado', navKey: 'none' },
        },
        {
          path: 'perfil',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { title: 'Meu perfil' },
        },
        {
          path: 'usuarios',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { adminOnly: true, title: 'Usuários' },
        },
        {
          path: 'aprovacoes',
          name: 'approvals',
          component: () => import('@/views/ApprovalsView.vue'),
          meta: { adminOnly: true, title: 'Aprovações' },
        },
        {
          path: 'categorias',
          name: 'categories',
          component: () => import('@/views/CategoriesView.vue'),
          meta: { adminOnly: true, title: 'Categorias' },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guestOnly: true, title: 'Entrar' },
    },
    {
      path: '/login/codigo',
      name: 'login-code',
      component: () => import('@/views/auth/LoginCodeView.vue'),
      meta: { guestOnly: true, title: 'Código de verificação' },
    },
    {
      path: '/confirmar-email',
      name: 'confirm-email',
      component: () => import('@/views/auth/ConfirmEmailView.vue'),
      meta: { guestOnly: true, title: 'Confirmar e-mail' },
    },
    {
      path: '/esqueci-senha',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { guestOnly: true, title: 'Esqueci minha senha' },
    },
    {
      path: '/criar-conta',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guestOnly: true, title: 'Criar conta' },
    },
    {
      // Fora do layout: com a senha temporária, a API recusa todo o resto até a troca
      path: '/criar-senha',
      name: 'password-change-required',
      component: () => import('@/views/auth/RequiredPasswordChangeView.vue'),
      meta: { requiresAuth: true, title: 'Defina sua nova senha' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Primeira tela: descobre no servidor se há sessão. Depois, confere a cada troca de tela
  // dentro da área logada (a conta pode ter sido desativada por um administrador).
  if (!auth.checked || (auth.isAuthenticated && to.matched.some((r) => r.meta.requiresAuth))) {
    try {
      await auth.loadSession()
    } catch {
      // Servidor fora do ar: deixa seguir; a tela mostra o erro de conexão
    }
  }

  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  if (auth.isAuthenticated && auth.passwordChangeRequired) {
    return to.name === 'password-change-required' ? true : { name: 'password-change-required' }
  }
  if (to.name === 'password-change-required') return { name: 'home' }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'home' }
  if (to.meta.handlerOnly && !auth.canHandleTickets) return { name: 'mine' }
  if (to.meta.adminOnly && !auth.isAdmin) return { name: 'home' }
  if (to.meta.overviewOnly && !auth.canBrowseAllTickets) return { name: 'home' }
})

router.afterEach((to) => {
  const auth = useAuthStore()
  const title = to.name === 'all-tickets' && !auth.isAdmin ? 'Chamados do setor' : to.meta.title
  document.title = title ? `${title} · CentralDesk` : 'CentralDesk'
})

export default router
