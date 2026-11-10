import { http } from './http'
import type {
  AdminUser,
  AdminUserDetail,
  AdminUserUpdate,
  ApiMessage,
  Assignee,
  Category,
  CategoryUsage,
  Comment,
  CurrentUser,
  Department,
  DepartmentRequest,
  Metrics,
  MetricsQuery,
  OverviewAssignee,
  OverviewOrder,
  Page,
  PrivilegeLevel,
  Priority,
  RegisteredUser,
  SectorRelation,
  TemporaryPassword,
  TicketDetail,
  TicketOrder,
  TicketOverview,
  TicketStatus,
  TicketSummary,
  TrustedDevice,
  TwoFactorChallenge,
  TwoFactorStatus,
  UserRoleFilter,
  UserStatus,
  Uuid,
} from './types'

export { ApiError, errorMessage } from './http'
export * from './types'

// Um objeto por área da API. As telas chamam daqui; o tratamento de erro fica no http.ts.

/** Login com senha certa: ou já entrou (CurrentUser) ou falta o código do e-mail (202). */
export type LoginResponse = CurrentUser | TwoFactorChallenge

export function isTwoFactorChallenge(response: LoginResponse): response is TwoFactorChallenge {
  return (response as TwoFactorChallenge).tfaRequired === true
}

export const authApi = {
  login: (email: string, password: string) => http.post<LoginResponse>('/auth/login', { email, password }),
  completeLogin: (code: string, trustThisBrowser: boolean) =>
    http.post<CurrentUser>('/auth/login/tfa', { code, trustThisBrowser }),
  resendLoginCode: () => http.post<ApiMessage>('/auth/login/tfa/resend'),
  register: (data: { fullName: string; cpf: string; email: string; password: string; departmentId: Uuid }) =>
    http.post<RegisteredUser>('/auth/register', data),
  verifyEmail: (email: string, code: string) => http.post<CurrentUser>('/auth/email/verify', { email, code }),
  resendVerificationCode: (email: string) => http.post<ApiMessage>('/auth/email/resend', { email }),
  forgotPassword: (email: string) => http.post<ApiMessage>('/auth/password/forgot', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    http.post('/auth/password/reset', { email, code, newPassword }),
  logout: () => http.post('/auth/logout'),
}

export const meApi = {
  get: () => http.get<CurrentUser>('/users/me'),
  rename: (fullName: string) => http.put<CurrentUser>('/users/me', { fullName }),
  /** `code`: exigido quando a verificação em duas etapas está ligada (POST /users/me/password/code). */
  changePassword: (currentPassword: string, newPassword: string, code?: string) =>
    http.patch('/users/me/password', code ? { currentPassword, newPassword, code } : { currentPassword, newPassword }),
  sendPasswordCode: () => http.post<ApiMessage>('/users/me/password/code'),
  closeAccount: (password: string) => http.delete('/users/me', { password }),
}

export const securityApi = {
  twoFactor: () => http.get<TwoFactorStatus>('/users/me/two-factor'),
  sendDisableCode: () => http.post<ApiMessage>('/users/me/two-factor/code'),
  enableTwoFactor: () => http.put<TwoFactorStatus>('/users/me/two-factor', { enabled: true }),
  disableTwoFactor: (currentPassword: string, code: string) =>
    http.put<TwoFactorStatus>('/users/me/two-factor', { enabled: false, currentPassword, code }),
  trustedDevices: () => http.get<TrustedDevice[]>('/users/me/trusted-devices'),
  removeTrustedDevice: (id: Uuid) => http.delete(`/users/me/trusted-devices/${id}`),
  removeAllTrustedDevices: () => http.delete('/users/me/trusted-devices'),
}

export const catalogApi = {
  departments: () => http.get<Department[]>('/departments'),
  categories: () => http.get<Category[]>('/categories'),
  priorities: () => http.get<Priority[]>('/priorities'),
}

export type TicketListKind = 'mine' | 'queue' | 'assigned'

export interface TicketListQuery {
  status?: TicketStatus
  categoryId?: Uuid
  priorityId?: number
  q?: string
  departmentId?: Uuid
  orderBy?: TicketOrder
  page?: number
  size?: number
}

/**
 * Filtros de "Todos os chamados". O escopo é decidido pela API: administrador vê tudo (e usa origem e destino);
 * coordenador vê o próprio setor (e usa `relation`; origem e destino são ignorados).
 */
export interface TicketOverviewQuery {
  status?: TicketStatus
  originDepartmentId?: Uuid
  targetDepartmentId?: Uuid
  relation?: SectorRelation
  categoryId?: Uuid
  priorityId?: number
  assigneeId?: Uuid
  unassigned?: boolean
  q?: string
  from?: string
  to?: string
  orderBy?: OverviewOrder
  page?: number
  size?: number
}

type TicketForm = { title: string; description: string; categoryId: Uuid; priorityId: number }

/**
 * Abertura: `originDepartmentId` só vai quando um administrador escolhe outro setor de origem.
 * Sem ele, a API usa o departamento de quem abre.
 */
type TicketCreateForm = TicketForm & { originDepartmentId?: Uuid }

export const ticketsApi = {
  list: (kind: TicketListKind, query: TicketListQuery = {}, signal?: AbortSignal) =>
    http.get<Page<TicketSummary>>(`/tickets/${kind}`, { ...query }, signal),
  overview: (query: TicketOverviewQuery = {}, signal?: AbortSignal) =>
    http.get<TicketOverview>('/tickets/overview', { ...query }, signal),
  overviewAssignees: () => http.get<OverviewAssignee[]>('/tickets/overview/assignees'),
  queueCount: () => http.get<{ openCount: number }>('/tickets/queue/count'),
  get: (id: Uuid) => http.get<TicketDetail>(`/tickets/${id}`),
  create: (data: TicketCreateForm) => http.post<TicketDetail>('/tickets', data),
  update: (id: Uuid, data: TicketForm) => http.put<TicketDetail>(`/tickets/${id}`, data),
  assign: (id: Uuid) => http.patch<TicketDetail>(`/tickets/${id}/assign`),
  close: (id: Uuid, resolution: string) => http.patch<TicketDetail>(`/tickets/${id}/close`, { resolution }),
  assignees: () => http.get<Assignee[]>('/tickets/assignees'),
  reassign: (id: Uuid, assigneeId: Uuid) => http.patch<TicketDetail>(`/tickets/${id}/reassign`, { assigneeId }),
  reopen: (id: Uuid, reason: string) => http.patch<TicketDetail>(`/tickets/${id}/reopen`, { reason }),
  exportSpreadsheet: () => http.download('/tickets/export'),
}

export const dashboardApi = {
  metrics: (query: MetricsQuery = {}, signal?: AbortSignal) =>
    http.get<Metrics>('/dashboard/metrics', { ...query }, signal),
}

export const commentsApi = {
  list: (ticketId: Uuid) => http.get<Comment[]>(`/tickets/${ticketId}/comments`),
  create: (ticketId: Uuid, content: string) => http.post<Comment>(`/tickets/${ticketId}/comments`, { content }),
}

export interface AdminUserQuery {
  status?: UserStatus
  search?: string
  role?: UserRoleFilter
  departmentId?: Uuid
  page?: number
  size?: number
}

export const adminUsersApi = {
  list: (query: AdminUserQuery = {}, signal?: AbortSignal) => http.get<Page<AdminUser>>('/users', { ...query }, signal),
  get: (id: Uuid) => http.get<AdminUserDetail>(`/users/${id}`),
  update: (id: Uuid, data: AdminUserUpdate) => http.put<AdminUserDetail>(`/users/${id}`, data),
  deactivate: (id: Uuid) => http.patch<AdminUser>(`/users/${id}/deactivate`),
  reactivate: (id: Uuid) => http.patch<AdminUser>(`/users/${id}/reactivate`),
  anonymize: (id: Uuid) => http.patch(`/users/${id}/anonymize`),
  changeDepartment: (id: Uuid, departmentId: Uuid) => http.patch<AdminUser>(`/users/${id}/department`, { departmentId }),
  changePrivilege: (id: Uuid, level: PrivilegeLevel) => http.put<AdminUser>(`/users/${id}/privilege`, { level }),
  resetPassword: (id: Uuid) => http.put<TemporaryPassword>(`/users/${id}/password-reset`),
}

export const departmentRequestsApi = {
  listPending: () => http.get<DepartmentRequest[]>('/department-requests'),
  approve: (id: Uuid) => http.patch<DepartmentRequest>(`/department-requests/${id}/approve`),
  reject: (id: Uuid) => http.patch<DepartmentRequest>(`/department-requests/${id}/reject`),
}

export const categoriesApi = {
  create: (data: { label: string; color: string }) => http.post<Category>('/categories', data),
  update: (id: Uuid, data: { label: string; color: string }) => http.patch<Category>(`/categories/${id}`, data),
  remove: (id: Uuid) => http.delete(`/categories/${id}`),
  usage: () => http.get<CategoryUsage[]>('/categories/usage'),
}
