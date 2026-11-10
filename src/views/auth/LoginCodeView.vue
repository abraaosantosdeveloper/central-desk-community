<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError, authApi, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import AuthLayout from '@/components/AuthLayout.vue'
import CodeInput from '@/components/CodeInput.vue'
import { useCountdown } from '@/composables/useCountdown'
import { useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'

// Segunda etapa do login: o código enviado por e-mail. O desafio fica num cookie HttpOnly.

const auth = useAuthStore()
const toasts = useToastsStore()
const router = useRouter()
const route = useRoute()
const countdown = useCountdown()

const code = ref('')
const trust = ref(true)
const busy = ref(false)
const error = ref('')

onMounted(() => {
  // Sem e-mail pendente (recarregou a página), o desafio pode ter sumido: o envio dirá
  countdown.start(60)
})

async function submit() {
  if (busy.value) return
  if (code.value.length !== 6) {
    error.value = 'Digite os 6 dígitos do código.'
    return
  }
  error.value = ''
  busy.value = true
  try {
    await auth.completeLogin(code.value, trust.value)
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/')
  } catch (err) {
    code.value = ''
    if (err instanceof ApiError && err.code === 'login-challenge-expired') {
      auth.clear('code-expired')
      await router.replace({ name: 'login' })
      return
    }
    if (err instanceof ApiError && err.code === 'account-blocked') {
      error.value = 'Conta bloqueada após 5 tentativas. Procure um administrador.'
      return
    }
    error.value = err instanceof ApiError && err.fieldErrors.code ? err.fieldErrors.code : errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function resend() {
  try {
    const response = await authApi.resendLoginCode()
    toasts.success(response.message)
    countdown.start(60)
  } catch (err) {
    if (err instanceof ApiError && err.retryAfter) countdown.start(err.retryAfter)
    toasts.error(errorMessage(err))
  }
}
</script>

<template>
  <AuthLayout :width="400">
    <span class="auth-icon" aria-hidden="true"><AppIcon name="mail" :size="24" :stroke-width="1.6" /></span>
    <div class="auth-head">
      <h1 class="auth-title">Confirme que é você</h1>
      <p class="muted">
        Enviamos um código de 6 dígitos para
        <strong style="color: var(--text)">{{ auth.pendingEmail || 'o seu e-mail' }}</strong>. Ele vale por 5 minutos.
      </p>
    </div>

    <form class="form" style="gap: 20px" novalidate @submit.prevent="submit">
      <CodeInput v-model="code" :invalid="!!error" />
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>

      <label class="checkbox checkbox--boxed">
        <input v-model="trust" type="checkbox">
        <span style="display: flex; flex-direction: column; gap: 2px">
          <span style="font-weight: 500">Confiar neste navegador por 30 dias</span>
          <span class="small muted">Desmarque em computadores compartilhados.</span>
        </span>
      </label>

      <button type="submit" class="btn btn--primary btn--block" :disabled="busy">{{ busy ? 'Confirmando…' : 'Confirmar' }}</button>
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px">
        <button type="button" class="link-button" :disabled="countdown.active.value" @click="resend">
          {{ countdown.active.value ? `Reenviar código em ${countdown.label.value}` : 'Reenviar código' }}
        </button>
        <RouterLink :to="{ name: 'login' }" class="section-link">Usar outra conta</RouterLink>
      </div>
    </form>

    <p class="small muted">Não pediu este código? Ignore o e-mail e avise um administrador. Códigos errados contam para o bloqueio da conta.</p>
  </AuthLayout>
</template>
