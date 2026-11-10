import type { AdminUser, PrivilegeLevel } from '@/api'
import { SUPPORT_TEAM_NAME } from '@/config'

/** Iniciais do nome para o avatar: "Marcos Oliveira" → "MO". */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

// Tons suaves dos avatares: fundo claro e texto escuro do mesmo tom (contraste acima de 7:1)
const AVATAR_TONES = [
  { bg: '#E3E8F5', fg: '#22356B' },
  { bg: '#E5F0E8', fg: '#1E5A35' },
  { bg: '#F4E6DA', fg: '#6B3410' },
  { bg: '#EEE6F7', fg: '#4E2A80' },
  { bg: '#E2F0EF', fg: '#14524D' },
  { bg: '#F6E3EA', fg: '#7A2142' },
  { bg: '#EDEDEB', fg: '#3F3E3A' },
]

/** O mesmo nome tem sempre a mesma cor. */
export function avatarTone(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]!
}

export const PRIVILEGE_LEVELS: PrivilegeLevel[] = ['ADMIN', 'COORDINATOR', 'COLLABORATOR']

export const PRIVILEGE_LABELS: Record<PrivilegeLevel, string> = {
  ADMIN: 'Administrador',
  COORDINATOR: 'Coordenador',
  COLLABORATOR: 'Colaborador',
}

export const PRIVILEGE_HINTS: Record<PrivilegeLevel, string> = {
  ADMIN: 'Gerencia contas, categorias e aprovações, vê todos os chamados e atende.',
  COORDINATOR: 'Acompanha os chamados que o próprio setor abriu ou recebeu.',
  COLLABORATOR: `Abre e acompanha os próprios chamados. Em ${SUPPORT_TEAM_NAME}, continua atendendo.`,
}

export function privilegeOf(user: Pick<AdminUser, 'admin' | 'coordinator'>): PrivilegeLevel {
  if (user.admin) return 'ADMIN'
  if (user.coordinator) return 'COORDINATOR'
  return 'COLLABORATOR'
}

/** Rótulo do papel na listagem de usuários. */
export function accountRoleLabel(user: Pick<AdminUser, 'admin' | 'coordinator' | 'ticketHandler'>): string {
  if (user.admin) return 'Administrador'
  if (user.coordinator) return user.ticketHandler ? 'Coordenador · atende' : 'Coordenador'
  if (user.ticketHandler) return 'Atendente'
  return 'Colaborador'
}

/** Por que o nível não pode ser escolhido (a API recusa com 409); `null` quando pode. */
export function privilegeBlockedReason(user: Pick<AdminUser, 'ticketHandler'>, level: PrivilegeLevel): string | null {
  return level === 'ADMIN' && !user.ticketHandler ? `Somente contas de ${SUPPORT_TEAM_NAME}` : null
}
