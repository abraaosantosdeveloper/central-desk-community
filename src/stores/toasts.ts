import { defineStore } from 'pinia'
import { ref } from 'vue'

// Avisos rápidos no canto da tela: toda ação do usuário recebe um retorno.

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const DURATION_MS = { success: 4000, info: 5000, error: 7000 } as const

export const useToastsStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function show(kind: ToastKind, message: string) {
    if (toasts.value.some((toast) => toast.message === message)) return
    const toast = { id: nextId++, kind, message }
    toasts.value = [...toasts.value, toast]
    setTimeout(() => dismiss(toast.id), DURATION_MS[kind])
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
    info: (message: string) => show('info', message),
  }
})
