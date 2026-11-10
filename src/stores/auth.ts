import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  ApiError,
  authApi,
  isTwoFactorChallenge,
  meApi,
  ROLE_ADMIN,
  ROLE_COORDINATOR,
  ROLE_PASSWORD_CHANGE_REQUIRED,
  ROLE_TICKET_HANDLER,
  type CurrentUser,
} from '@/api'
import { setSessionExpiredHandler } from '@/api/http'
import { SUPPORT_TEAM_NAME } from '@/config'

// Sessão real: os tokens ficam em cookies HttpOnly (o JavaScript nunca os vê).
// Esta store só guarda quem está logado, lido de GET /users/me.

/** Rótulo do perfil exibido na interface. */
export function roleLabel(user: Pick<CurrentUser, 'roles'> | null | undefined): string {
  if (!user) return ''
  if (user.roles.includes(ROLE_ADMIN)) return 'Administração'
  if (user.roles.includes(ROLE_COORDINATOR)) return 'Coordenação'
  if (user.roles.includes(ROLE_TICKET_HANDLER)) return `Atendimento · ${SUPPORT_TEAM_NAME}`
  return 'Colaborador'
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Por que a pessoa foi mandada para o login (mostrado na tela de login). */
export type LogoutReason = 'expired' | 'ended' | 'deactivated' | 'closed' | 'code-expired' | null

/** Códigos de verificação: só os dígitos (aceita colar "042 917"). */
export function normalizeCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, 6)
}

/** Quanto a conferência de sessão espera o servidor antes de liberar a tela. */
const SESSION_CHECK_TIMEOUT_MS = 8000

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<CurrentUser | null>(null)
  const checked = ref(false)
  const logoutReason = ref<LogoutReason>(null)
  /** E-mail à espera de um código (login em duas etapas ou confirmação do cadastro). Só em memória. */
  const pendingEmail = ref('')
  /** A última conferência de sessão não chegou ao servidor (fora do ar, iniciando ou sem rede). */
  const serverUnavailable = ref(false)

  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.roles.includes(ROLE_ADMIN) ?? false)
  const isHandler = computed(() => currentUser.value?.roles.includes(ROLE_TICKET_HANDLER) ?? false)
  const isCoordinator = computed(() => currentUser.value?.roles.includes(ROLE_COORDINATOR) ?? false)
  /** "Todos os chamados", painel ao vivo e métricas: administrador (tudo) ou coordenador (o setor). */
  const canBrowseAllTickets = computed(() => isAdmin.value || isCoordinator.value)
  /** Atende chamados: setor de atendimento ou administrador (a API usa a mesma regra). */
  const canHandleTickets = computed(() => isHandler.value || isAdmin.value)
  /** Administradores e coordenadores do setor de atendimento podem assumir os próprios chamados. */
  const canTakeOwnTickets = computed(() => isAdmin.value || (isCoordinator.value && isHandler.value))
  const passwordChangeRequired = computed(
    () => currentUser.value?.roles.includes(ROLE_PASSWORD_CHANGE_REQUIRED) ?? false,
  )

  function clear(reason: LogoutReason = null) {
    currentUser.value = null
    logoutReason.value = reason
  }

  setSessionExpiredHandler(() => {
    if (currentUser.value) clear('expired')
  })

  /** Confere no servidor quem está logado. Chamado ao abrir o app e ao trocar de tela. */
  async function loadSession(): Promise<void> {
    try {
      currentUser.value = await meApi.get(SESSION_CHECK_TIMEOUT_MS)
      serverUnavailable.value = false
    } catch (error) {
      serverUnavailable.value = error instanceof ApiError && (error.isNetworkError || error.status >= 500)
      if (error instanceof ApiError && error.status === 403) clear('deactivated')
      else if (error instanceof ApiError && error.status === 401) clear(currentUser.value ? 'expired' : null)
      else if (!currentUser.value) throw error
    } finally {
      checked.value = true
    }
  }

  /** A API avisou que as sessões desta conta foram encerradas: confere na hora. */
  async function recheckSession(): Promise<void> {
    const wasAuthenticated = isAuthenticated.value
    await loadSession()
    if (wasAuthenticated && !isAuthenticated.value && logoutReason.value !== 'deactivated') {
      logoutReason.value = 'ended'
    }
  }

  function signIn(user: CurrentUser) {
    currentUser.value = user
    logoutReason.value = null
    pendingEmail.value = ''
  }

  async function login(email: string, password: string): Promise<'signed-in' | 'code-required'> {
    const normalized = normalizeEmail(email)
    const response = await authApi.login(normalized, password)
    if (isTwoFactorChallenge(response)) {
      pendingEmail.value = normalized
      return 'code-required'
    }
    signIn(response)
    return 'signed-in'
  }

  async function completeLogin(code: string, trustThisBrowser: boolean) {
    signIn(await authApi.completeLogin(normalizeCode(code), trustThisBrowser))
  }

  async function register(data: {
    fullName: string
    cpf: string
    email: string
    password: string
    departmentId: string
  }): Promise<'verify-email' | 'signed-in' | 'code-required'> {
    const email = normalizeEmail(data.email)
    const created = await authApi.register({ ...data, fullName: data.fullName.trim(), email })
    if (created?.status === 'PENDING_VERIFICATION') {
      pendingEmail.value = email
      return 'verify-email'
    }
    return login(email, data.password)
  }

  async function verifyEmail(email: string, code: string) {
    signIn(await authApi.verifyEmail(normalizeEmail(email), normalizeCode(code)))
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clear()
    }
  }

  async function rename(fullName: string) {
    const roles = currentUser.value?.roles ?? []
    const updated = await meApi.rename(fullName.trim())
    currentUser.value = { ...updated, roles: updated.roles ?? roles }
  }

  async function changePassword(currentPassword: string, newPassword: string, code?: string) {
    await meApi.changePassword(currentPassword, newPassword, code ? normalizeCode(code) : undefined)
    await loadSession()
  }

  async function closeAccount(password: string) {
    await meApi.closeAccount(password)
    clear('closed')
  }

  return {
    currentUser,
    checked,
    logoutReason,
    pendingEmail,
    serverUnavailable,
    isAuthenticated,
    passwordChangeRequired,
    isAdmin,
    isHandler,
    isCoordinator,
    canBrowseAllTickets,
    canHandleTickets,
    canTakeOwnTickets,
    loadSession,
    recheckSession,
    login,
    completeLogin,
    register,
    verifyEmail,
    logout,
    rename,
    changePassword,
    closeAccount,
    clear,
  }
})
