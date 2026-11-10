import type { ProblemDetail } from './types'

// Cliente HTTP único do front. Concentra três coisas, para nenhuma tela precisar repetir:
// 1. os cookies de sessão vão sozinhos (mesma origem, via proxy /api);
// 2. quando o access token vence (401), renova a sessão UMA vez e repete a chamada;
// 3. todo erro vira um ApiError com mensagem em português, pronta para mostrar ao usuário.

const BASE_URL = '/api'

// Rotas que não renovam a sessão ao receber 401: ou são o próprio login/renovação,
// ou o 401 delas significa outra coisa (ex.: senha errada).
const NO_REFRESH = [
  '/auth/login',
  '/auth/login/tfa',
  '/auth/login/tfa/resend',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/email/verify',
  '/auth/email/resend',
  '/auth/password/forgot',
  '/auth/password/reset',
]

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  /** Erros por campo do formulário (400), já em português, vindos da API. */
  readonly fieldErrors: Record<string, string>
  /** Motivo do erro para o front decidir a tela (ex.: "account-blocked"), quando a API manda. */
  readonly code: string
  /** Segundos até poder tentar de novo (429, cabeçalho Retry-After). */
  readonly retryAfter: number | null

  constructor(
    status: number,
    title: string,
    message: string,
    fieldErrors: Record<string, string> = {},
    code = '',
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.fieldErrors = fieldErrors
    this.code = code
    this.retryAfter = retryAfter
  }

  get isNetworkError() {
    return this.status === 0
  }
}

/** Mensagem genérica por status, usada quando a API não manda um `detail`. */
function fallbackMessage(status: number): string {
  if (status === 0) return 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.'
  if (status === 401) return 'Sua sessão expirou. Entre novamente para continuar.'
  if (status === 403) return 'Você não tem permissão para fazer isso.'
  if (status === 404) return 'Não encontramos o que você procurava. Pode ter sido removido.'
  if (status === 409) return 'Essa ação não é mais possível: os dados mudaram. Atualize a página.'
  if (status === 429) return 'Muitas tentativas. Aguarde um pouco e tente de novo.'
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.'
  return 'Não foi possível concluir a operação.'
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail = {}
  try {
    const text = await response.text()
    if (text) problem = JSON.parse(text) as ProblemDetail
  } catch {
    // Corpo vazio ou não-JSON (ex.: 401/403 do Spring Security): fica a mensagem padrão
  }
  const retryHeader = Number(response.headers.get('Retry-After'))
  return new ApiError(
    response.status,
    problem.title ?? '',
    problem.detail ?? fallbackMessage(response.status),
    problem.errors ?? {},
    problem.code ?? '',
    Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null,
  )
}

// --- Renovação de sessão ---

// Uma renovação por vez: duas simultâneas fariam a API detectar "reuso" e derrubar a sessão.
let refreshing: Promise<boolean> | null = null
let onSessionExpired: (() => void) | null = null

/** A store de autenticação registra aqui o que fazer quando a sessão não pode ser renovada. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// --- Requisições ---

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
  /** Desiste depois deste tempo (ms) e trata como "sem conexão". Sem valor, espera o quanto for. */
  timeoutMs?: number
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return `${BASE_URL}${path}${search ? `?${search}` : ''}`
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const signals = [options.signal, options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined].filter(
    (signal): signal is AbortSignal => signal !== undefined,
  )
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
    })
  } catch (error) {
    // Cancelado por quem chamou: repassa. Estourou o timeout (TimeoutError) ou a rede caiu: "sem conexão".
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Sem conexão', fallbackMessage(0))
  }
}

// Envia; no 401, renova a sessão uma vez e repete. Erro vira ApiError.
async function sendWithRefresh(path: string, options: RequestOptions): Promise<Response> {
  let response = await send(path, options)

  if (response.status === 401 && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) {
      response = await send(path, options)
    }
    if (response.status === 401) {
      onSessionExpired?.()
    }
  }

  if (!response.ok) throw await toApiError(response)
  return response
}

export async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await sendWithRefresh(path, options)
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export interface DownloadedFile {
  blob: Blob
  /** Nome sugerido pela API (Content-Disposition); vazio se ela não mandar. */
  fileName: string
}

/** Arquivo binário (planilha), com a mesma renovação de sessão e os mesmos erros das demais chamadas. */
export async function download(path: string, query?: RequestOptions['query']): Promise<DownloadedFile> {
  const response = await sendWithRefresh(path, { query })
  return { blob: await response.blob(), fileName: fileNameOf(response.headers.get('Content-Disposition')) }
}

// attachment; filename="chamados-2026-11-09.xlsx" (ou filename*=UTF-8''...)
function fileNameOf(disposition: string | null): string {
  if (!disposition) return ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (encoded) return decodeURIComponent(encoded[1]!.trim())
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1]!.trim() : ''
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T = void>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T = void>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T = void>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  download,
}

/** Mensagem pronta para a tela, venha o erro da API ou de outro lugar. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Algo deu errado. Tente de novo.'
}
