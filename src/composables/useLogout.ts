import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'

/** Saída da conta com confirmação: o botão só abre a pergunta; a sessão termina em "Sair". */
export function useLogout() {
  const auth = useAuthStore()
  const toasts = useToastsStore()

  const confirming = ref(false)
  const busy = ref(false)

  function ask() {
    confirming.value = true
  }

  function cancel() {
    confirming.value = false
  }

  async function confirm() {
    if (busy.value) return
    busy.value = true
    try {
      await auth.logout()
    } catch {
      // A sessão deste navegador já foi limpa mesmo sem resposta da API
    } finally {
      busy.value = false
      confirming.value = false
    }
    toasts.success('Você saiu da sua conta.')
  }

  return { confirming, busy, ask, cancel, confirm }
}
