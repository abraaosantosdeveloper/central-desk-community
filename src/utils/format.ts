const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const longDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

/** "14/10/2026, 09:12" */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** "14/10/2026" */
export function formatDate(iso: string): string {
  return date.format(new Date(iso))
}

/** "14 de out." */
export function formatShortDay(iso: string): string {
  return shortDay.format(new Date(iso))
}

/** "Segunda-feira, 26 de outubro" */
export function formatToday(now = new Date()): string {
  const text = longDay.format(now)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "09:12" se for hoje; senão "14 de out., 09:12". */
export function formatShortTime(iso: string, now = new Date()): string {
  const value = new Date(iso)
  return value.toDateString() === now.toDateString()
    ? time.format(value)
    : `${shortDay.format(value)}, ${time.format(value)}`
}

/** Duração legível: "14 min", "2 h 5 min", "3 d 4 h". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest ? `${hours} h ${rest} min` : `${hours} h`
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days} d ${restHours} h` : `${days} d`
}

/** Duração vinda da API em segundos; "—" quando não há dado. */
export function formatSeconds(seconds: number | null | undefined): string {
  return seconds === null || seconds === undefined ? '—' : formatDuration(seconds * 1000)
}

/** "agora", "há 27 min", "há 2 h 5 min", "ontem", "há 3 dias". */
export function formatAgo(iso: string, now = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime()
  if (elapsed < 60000) return 'agora'
  const hours = elapsed / 3_600_000
  if (hours < 24) return `há ${formatDuration(elapsed)}`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  return formatShortDay(iso)
}

/** Tempo de espera, sem o "há": "15 min", "5 h", "2 dias". */
export function formatWaitingShort(iso: string, now = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime()
  if (elapsed < 60000) return 'agora'
  const hours = elapsed / 3_600_000
  if (hours < 24) return formatDuration(elapsed).replace(/ \d+ min$/, '')
  const days = Math.floor(hours / 24)
  return days === 1 ? 'ontem' : `${days} dias`
}

/** Saudação pela hora do dia. */
export function greeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** AAAA-MM-DD no fuso do navegador. */
export function isoDay(value: Date): string {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysAgo(days: number, from = new Date()): Date {
  const value = new Date(from)
  value.setDate(value.getDate() - days)
  return value
}

export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}
