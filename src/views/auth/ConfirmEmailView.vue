<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError, authApi, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import AuthLayout from '@/components/AuthLayout.vue'
import CodeInput from '@/components/CodeInput.vue'
import { EMAIL_PLACEHOLDER } from '@/config'
import { useCountdown } from '@/composables/useCountdown'
import { normalizeEmail, useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'

// Passo 2 do cadastro: o código enviado para o e-mail. Confirmar já abre a sessão.
// O e-mail vem do cadastro (memória) ou da URL (?email=), para sobreviver a um recarregamento.

const RESEND_WAIT_SECONDS = 60

const auth = useAuthStore()
const toasts = useToastsStore()
const route = useRoute()
const router = useRouter()
const countdown = useCountdown()

const queryEmail = typeof route.query.email === 'string' ? route.query.email : ''
const email = ref(normalizeEmail(auth.pendingEmail || queryEmail))
/** Sem e-mail conhecido (link aberto direto): a pessoa digita. */
const askEmail = !email.value
const code = ref('')
const busy = ref(false)
const resending = ref(false)
const error = ref('')
const emailError = ref('')

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email.value)))

const steps = ['Dados e departamento', 'Confirmar o e-mail', 'Primeiro chamado']

onMounted(() => {
  if (!askEmail) countdown.start(RESEND_WAIT_SECONDS)
  if (route.query.reenviado) toasts.info('Sua conta ainda não foi confirmada. Enviamos um novo código para o seu e-mail.')
})

async function submit() {
  if (busy.value) return
  error.value = ''
  emailError.value = emailValid.value ? '' : 'Informe o e-mail do cadastro.'
  if (emailError.value) return
  if (code.value.length !== 6) {
    error.value = 'Digite os 6 dígitos do código.'
    return
  }
  busy.value = true
  try {
    await auth.verifyEmail(email.value, code.value)
    toasts.success('E-mail confirmado! Boas-vindas ao CentralDesk.')
    await router.replace({ name: 'home' })
  } catch (err) {
    code.value = ''
    error.value = err instanceof ApiError && err.status === 400 ? 'Código inválido ou expirado.' : errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function resend() {
  if (resending.value) return
  emailError.value = emailValid.value ? '' : 'Informe o e-mail do cadastro para receber outro código.'
  if (emailError.value) return
  resending.value = true
  try {
    const response = await authApi.resendVerificationCode(normalizeEmail(email.value))
    toasts.success(response?.message ?? 'Enviamos um novo código para o seu e-mail.')
    countdown.start(RESEND_WAIT_SECONDS)
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) countdown.start(err.retryAfter ?? RESEND_WAIT_SECONDS)
    toasts.error(errorMessage(err))
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <AuthLayout :width="400">
    <ol aria-label="Etapas do cadastro" class="steps">
      <li v-for="(label, index) in steps" :key="label" :class="{ 'is-done': index <= 1 }" :aria-current="index === 1 ? 'step' : undefined">
        <span class="steps__bar" />{{ index + 1 }}. {{ label }}
      </li>
    </ol>

    <span class="auth-icon" aria-hidden="true"><AppIcon name="mail" :size="24" :stroke-width="1.6" /></span>
    <div class="auth-head">
      <h1 class="auth-title">Confirme seu e-mail</h1>
      <p v-if="!askEmail" class="muted">
        Enviamos um código de 6 dígitos para <strong style="color: var(--text)">{{ email }}</strong>. Ele vale por 10 minutos.
      </p>
      <p v-else class="muted">Digite o e-mail do cadastro e o código de 6 dígitos que enviamos para ele.</p>
    </div>

    <form class="form" style="gap: 20px" novalidate @submit.prevent="submit">
      <div v-if="askEmail" class="field">
        <label for="confirm-email" class="label">E-mail do cadastro</label>
        <input id="confirm-email" v-model="email" class="input" type="email" autocomplete="username" :placeholder="EMAIL_PLACEHOLDER" :aria-invalid="!!emailError || undefined">
        <span v-if="emailError" class="field-error">{{ emailError }}</span>
      </div>
      <p v-else-if="emailError" class="field-error" role="alert">{{ emailError }}</p>
      <CodeInput v-model="code" :invalid="!!error" />
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn--primary btn--block" :disabled="busy">{{ busy ? 'Confirmando…' : 'Confirmar e entrar' }}</button>
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px">
        <button type="button" class="link-button" :disabled="countdown.active.value || resending" @click="resend">
          {{ countdown.active.value ? `Reenviar código em ${countdown.label.value}` : resending ? 'Enviando…' : 'Reenviar código' }}
        </button>
        <RouterLink :to="{ name: 'login', query: email ? { email } : {} }" class="section-link">Voltar para o login</RouterLink>
      </div>
    </form>

    <p class="small muted">
      Não recebeu? Confira a caixa de spam. Cadastros não confirmados em 24 horas são descartados; depois disso,
      <RouterLink :to="{ name: 'register' }">crie a conta de novo</RouterLink>.
    </p>
  </AuthLayout>
</template>

<style scoped>
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
}
.steps li {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--faint);
}
.steps li.is-done {
  color: var(--text);
}
.steps__bar {
  height: 3px;
  border-radius: 2px;
  background: var(--border);
}
.is-done .steps__bar {
  background: var(--accent);
}
</style>
