import type { TicketStatus } from '@/api'

export const TITLE_MAX_LENGTH = 120
export const DESCRIPTION_MAX_LENGTH = 5000
export const COMMENT_MAX_LENGTH = 5000
export const RESOLUTION_MAX_LENGTH = 2000
export const REOPEN_MIN_LENGTH = 10
export const REOPEN_MAX_LENGTH = 1000
/** Reabertura: até 7 dias depois do encerramento (a API confere). */
export const REOPEN_WINDOW_DAYS = 7

/** "#1042" pelo número; sem número (base antiga), os 8 primeiros caracteres do id. */
export function ticketCode(ticket: { id: string; number?: number | null }): string {
  return ticket.number ? `#${ticket.number}` : `#${ticket.id.slice(0, 8).toUpperCase()}`
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
}

export const STATUS_ORDER: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED']

/** Dicas do formulário, pelo id da prioridade (1 = Baixa … 4 = Crítica). */
export const PRIORITY_HINTS: Record<number, string> = {
  1: 'Pedido ou melhoria sem prazo apertado.',
  2: 'Atrapalha, mas dá para seguir por outro caminho.',
  3: 'Você está impedido, sem alternativa.',
  4: 'O trabalho de um setor está parado.',
}

/** Paleta de cores sugerida para categorias (todas com contraste para a bolinha sobre branco). */
export const CATEGORY_SWATCHES = ['#2B59C3', '#0F766E', '#7C3AED', '#C2410C', '#B45309', '#BE185D', '#6F6E69']

/** Encerrado há no máximo 7 dias: ainda pode ser reaberto. */
export function withinReopenWindow(closedAt: string | null, now = new Date()): boolean {
  if (!closedAt) return false
  return now.getTime() - new Date(closedAt).getTime() <= REOPEN_WINDOW_DAYS * 86_400_000
}

export function reopenDeadline(closedAt: string): Date {
  return new Date(new Date(closedAt).getTime() + REOPEN_WINDOW_DAYS * 86_400_000)
}
