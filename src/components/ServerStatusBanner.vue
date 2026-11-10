<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Aviso fixo quando a API não responde (back-end fora do ar ou ainda iniciando).
// Tenta de novo sozinho a cada poucos segundos; quando volta, retoma a tela certa.

const RETRY_EVERY_MS = 5000

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const retrying = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function retry() {
  if (retrying.value) return
  retrying.value = true
  clearTimeout(timer)
  try {
    await auth.loadSession()
  } catch {
    // Continua fora: o aviso segue na tela e agenda outra tentativa
  } finally {
    retrying.value = false
  }
  if (auth.serverUnavailable) {
    timer = setTimeout(retry, RETRY_EVERY_MS)
    return
  }
  // Voltou. Quem tinha sessão e estava na tela de login vai para onde queria.
  if (auth.isAuthenticated && route.meta.guestOnly) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  }
}

watch(
  () => auth.serverUnavailable,
  (unavailable) => {
    clearTimeout(timer)
    if (unavailable) timer = setTimeout(retry, RETRY_EVERY_MS)
  },
  { immediate: true },
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div v-if="auth.serverUnavailable" class="server-banner" role="status" aria-live="polite">
    <span class="server-banner__text">
      Não foi possível falar com o servidor. Ele pode estar iniciando; tentando de novo automaticamente.
    </span>
    <button type="button" class="server-banner__retry" :disabled="retrying" @click="retry">
      {{ retrying ? 'Tentando…' : 'Tentar agora' }}
    </button>
  </div>
</template>

<style scoped>
.server-banner {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 10px 16px;
  background: var(--warning-tint);
  color: var(--warning-deep);
  border-bottom: 1px solid var(--border-strong);
  font-size: 14px;
}
.server-banner__retry {
  padding: 4px 12px;
  border: 1px solid currentColor;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.server-banner__retry:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
