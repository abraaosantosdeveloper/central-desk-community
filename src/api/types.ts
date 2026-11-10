// Formatos da API do CentralDesk (back-end Spring). Os nomes seguem os DTOs Java.

export type Uuid = string

export const ROLE_ADMIN = 'ROLE_ADMIN'
export const ROLE_TICKET_HANDLER = 'TICKET_HANDLER'
/** Coordena o próprio departamento: acompanha o que o setor abriu ou recebeu (a API confere no banco). */
export const ROLE_COORDINATOR = 'COORDINATOR'
/** Entrou com senha temporária: a API só libera ver o perfil, trocar a senha e sair. */
export const ROLE_PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED'

export type UserStatus = 'ACTIVE' | 'DEACTIVATED' | 'ANONYMIZED' | 'BLOCKED' | 'PENDING_VERIFICATION'
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
export type DepartmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface CurrentUser {
  id: Uuid
  fullName: string
  email: string
  status: UserStatus
  departmentId: Uuid
  departmentName: string
  /** Pedido de entrada no setor de atendimento aguardando um administrador. */
  departmentApprovalPending: boolean
  createdAt: string
  roles: string[]
}

export interface Department {
  id: Uuid
  name: string
}

export interface Category {
  id: Uuid
  label: string
  color: string
}

export interface Priority {
  id: number
  label: string
}

export interface TicketDetail {
  id: Uuid
  /** Número sequencial do chamado (#1042). Pode faltar em bases antigas. */
  number: number | null
  title: string
  description: string
  status: TicketStatus
  category: Category
  priority: Priority
  requesterId: Uuid
  requesterName: string
  /** Setor de origem: o departamento de quem abriu, no momento da abertura (nunca muda). */
  originDepartment: Department | null
  /** Setor de destino: quem recebe o chamado. */
  targetDepartment: Department | null
  assigneeId: Uuid | null
  assigneeName: string | null
  assignedAt: string | null
  closedById: Uuid | null
  closedByName: string | null
  closedAt: string | null
  /** O que foi feito, registrado por quem encerrou. */
  resolution: string | null
  createdAt: string
  updatedAt: string | null
}

export interface TicketSummary {
  id: Uuid
  number: number | null
  title: string
  status: TicketStatus
  category: Category
  priority: Priority
  requesterId: Uuid
  requesterName: string
  originDepartment: Department | null
  targetDepartment: Department | null
  assigneeId: Uuid | null
  assigneeName: string | null
  createdAt: string
  updatedAt: string | null
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface Comment {
  id: Uuid
  ticketId: Uuid
  authorId: Uuid
  authorName: string
  content: string
  createdAt: string
}

export interface AdminUser {
  id: Uuid
  fullName: string
  email: string
  status: UserStatus
  departmentId: Uuid
  departmentName: string
  admin: boolean
  /** Coordena o próprio departamento (exclusivo com `admin`). */
  coordinator: boolean
  ticketHandler: boolean
  departmentApprovalPending: boolean
  createdAt: string
  deactivatedAt: string | null
  /** Quando a conta foi bloqueada por tentativas erradas (vazio se não está bloqueada). */
  blockedAt: string | null
}

/** Conta aberta pelo administrador (GET /users/{id}): os campos da listagem mais o CPF. */
export interface AdminUserDetail extends AdminUser {
  cpf: string | null
}

/** Correção dos dados de uma conta pelo administrador (PUT /users/{id}). Vão todos os campos. */
export interface AdminUserUpdate {
  fullName: string
  cpf: string
  email: string
  departmentId: Uuid
}

export interface DepartmentRequest {
  id: Uuid
  userId: Uuid
  userName: string
  userEmail: string
  departmentId: Uuid
  departmentName: string
  status: DepartmentRequestStatus
  createdAt: string
  reviewedById: Uuid | null
  reviewedAt: string | null
}

/** Corpo de erro da API (RFC 9457). `errors` traz os campos inválidos, quando houver. */
export interface ProblemDetail {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  errors?: Record<string, string>
  /** Motivo do erro para o front decidir a tela (ex.: "account-blocked", "email-not-verified"). */
  code?: string
}

export interface CategoryUsage {
  categoryId: Uuid
  tickets: number
}

/** Quem pode atender chamados, com quantos tem em atendimento. */
export interface Assignee {
  id: Uuid
  fullName: string
  departmentName: string
  inProgress: number
}

export interface OverviewAssignee {
  id: Uuid
  fullName: string
  departmentName: string
}

export type TicketOrder = 'RECENT' | 'PRIORITY'

/** Coordenador: o setor abriu (ORIGIN), recebeu (TARGET) ou os dois (BOTH, padrão). */
export type SectorRelation = 'ORIGIN' | 'TARGET' | 'BOTH'
export type OverviewOrder = 'RECENT' | 'PRIORITY' | 'UPDATED'

/** Contadores das abas, com os mesmos filtros da lista, menos o de status. */
export interface StatusCounts {
  all: number
  OPEN: number
  IN_PROGRESS: number
  CLOSED: number
}

export interface TicketOverview extends Page<TicketSummary> {
  statusCounts: StatusCounts
}

export type UserRoleFilter = 'ADMIN' | 'COORDINATOR' | 'HANDLER' | 'COLLABORATOR'

/** Níveis de privilégio, exclusivos entre si (PUT /users/{id}/privilege). Atender vem do departamento. */
export type PrivilegeLevel = 'ADMIN' | 'COORDINATOR' | 'COLLABORATOR'

/** Conta criada no cadastro (POST /auth/register). */
export interface RegisteredUser {
  id: Uuid
  fullName: string
  email: string
  status: UserStatus
  departmentId: Uuid
  departmentName: string
  departmentApprovalPending: boolean
  createdAt: string
}

/** Login com senha certa, mas falta o código do e-mail (202). */
export interface TwoFactorChallenge {
  tfaRequired: true
}

export interface TwoFactorStatus {
  enabled: boolean
  /** Obrigatória (administradores): não pode ser desligada. */
  mandatory: boolean
}

/** Navegador dispensado do código por 30 dias. */
export interface TrustedDevice {
  id: Uuid
  label: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
}

/** Senha temporária gerada pelo administrador: aparece só nesta resposta. */
export interface TemporaryPassword {
  temporaryPassword: string
  expiresAt: string
}

export interface ApiMessage {
  message: string
}

// --- Painel de métricas (GET /dashboard/metrics) ---

export interface MetricsQuery {
  /** Primeiro dia do período (AAAA-MM-DD); sem período, a API usa os últimos 30 dias. */
  from?: string
  to?: string
  /** Só administradores; para coordenadores a API ignora e usa o setor deles. */
  originDepartmentId?: Uuid
  categoryId?: Uuid
  priorityId?: number
}

export interface MetricsPeriod {
  from: string
  to: string
}

/** Chamados abertos no período e o que aconteceu com eles. Tempos em segundos (null = sem dados). */
export interface MetricsSummary {
  total: number
  taken: number
  closed: number
  reopened: number
  avgResponseSeconds: number | null
  avgResolutionSeconds: number | null
}

export interface MetricsDay {
  date: string
  opened: number
  closed: number
}

export interface MetricsPriorityShare {
  id: number
  label: string
  count: number
}

export interface MetricsGroupStat {
  id: Uuid
  label: string
  count: number
  avgResolutionSeconds: number | null
}

export interface MetricsAssigneeStat {
  id: Uuid
  name: string
  inProgress: number
  taken: number
  closed: number
  avgResponseSeconds: number | null
  avgResolutionSeconds: number | null
}

export interface MetricsOldestTicket {
  id: Uuid
  number: number
  title: string
  requesterName: string
  requesterDepartment: string
  createdAt: string
}

export interface Metrics {
  period: MetricsPeriod
  previousPeriod: MetricsPeriod
  /** Setor de origem aplicado; null = todos os setores. */
  sector: { id: Uuid; name: string } | null
  /** true = o setor é do coordenador e não pode ser trocado. */
  sectorLocked: boolean
  summary: MetricsSummary
  previousSummary: MetricsSummary
  now: { open: number; unassigned: number }
  perDay: MetricsDay[]
  byPriority: MetricsPriorityShare[]
  byCategory: MetricsGroupStat[]
  byOriginDepartment: MetricsGroupStat[]
  byAssignee: MetricsAssigneeStat[]
  oldestUnassigned: MetricsOldestTicket[]
  generatedAt: string
}
