<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import AuthLayout from '@/components/AuthLayout.vue'
import { EMAIL_PLACEHOLDER } from '@/config'
import { useCountdown } from '@/composables/useCountdown'
import { normalizeEmail, useAuthStore } from '@/stores/auth'

// Login. Senha certa: entra direto, ou segue para o código do e-mail (duas etapas).
// Conta ainda não confirmada: a API reenvia o código e a tela de confirmação abre sozinha.

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const rateLimit = useCountdown()

const email = ref(auth.pendingEmail || (typeof route.query.email === 'string' ? route.query.email : ''))
const password = ref('')
const showPassword = ref(false)
const busy = ref(false)

type Problem = 'invalid' | 'blocked' | 'other' | null
const problem = ref<Problem>(null)
const problemText = ref('')
const fieldErrors = ref<Record<string, string>>({})

const reasonText = computed(() => {
  switch (auth.logoutReason) {
    case 'expired':
      return 'Sua sessão expirou. Entre novamente para continuar.'
    case 'ended':
      return 'Sua sessão foi encerrada porque os dados de acesso da conta mudaram (e-mail ou senha). Entre novamente.'
    case 'deactivated':
      return 'Sua conta foi desativada por um administrador. Se achar que é um engano, fale com a equipe de atendimento.'
    case 'closed':
      return 'Sua conta foi encerrada e seus dados pessoais foram removidos.'
    case 'code-expired':
      return 'A verificação expirou. Entre de novo para receber um novo código.'
    default:
      return ''
  }
})

function redirectQuery() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : {}
}

function redirectTarget() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
}

async function submit() {
  if (busy.value || rateLimit.active.value) return
  problem.value = null
  const errors: Record<string, string> = {}
  if (!email.value.trim()) errors.email = 'Informe seu e-mail.'
  if (!password.value) errors.password = 'Informe sua senha.'
  fieldErrors.value = errors
  if (Object.keys(errors).length) return

  busy.value = true
  try {
    const result = await auth.login(email.value, password.value)
    if (result === 'code-required') {
      await router.push({ name: 'login-code', query: redirectQuery() })
    } else {
      await router.replace(redirectTarget())
    }
  } catch (error) {
    password.value = ''
    if (error instanceof ApiError && error.status === 401) {
      problem.value = 'invalid'
    } else if (error instanceof ApiError && error.code === 'account-blocked') {
      problem.value = 'blocked'
    } else if (error instanceof ApiError && error.code === 'email-not-verified') {
      // A API já reenviou o código para o e-mail: segue para a confirmação
      auth.pendingEmail = normalizeEmail(email.value)
      await router.push({ name: 'confirm-email', query: { email: auth.pendingEmail, reenviado: '1' } })
    } else if (error instanceof ApiError && error.status === 429) {
      rateLimit.start(error.retryAfter ?? 60)
      problem.value = 'other'
      problemText.value = error.message
    } else if (error instanceof ApiError && error.status === 403) {
      problem.value = 'other'
      problemText.value = 'Sua conta está desativada. Fale com um administrador para reativá-la.'
    } else if (error instanceof ApiError && error.status === 400) {
      fieldErrors.value = error.fieldErrors
      problem.value = 'other'
      problemText.value = error.message
    } else {
      problem.value = 'other'
      problemText.value = errorMessage(error)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout :width="380" footer>
    <div class="auth-head">
      <h1 class="auth-title">Entrar</h1>
      <p class="muted">Use o e-mail da sua conta para acessar seus chamados.</p>
    </div>

    <p v-if="reasonText && !problem" class="callout" role="status">
      <AppIcon name="info" />
      <span>{{ reasonText }}</span>
    </p>

    <div v-if="problem === 'blocked'" role="alert" class="callout callout--danger">
      <AppIcon name="lock" />
      <span>
        <strong>Conta bloqueada.</strong> Por segurança, o acesso foi bloqueado após 5 tentativas erradas.
        Só um administrador pode liberar, gerando uma senha temporária para você.
      </span>
    </div>
    <div v-else-if="problem === 'invalid'" role="alert" class="callout">
      <AppIcon name="alert" style="color: var(--danger-text)" />
      <span>E-mail ou senha incorretos. Depois de 5 tentativas erradas, a conta é bloqueada.</span>
    </div>
    <div v-else-if="problem === 'other'" role="alert" class="callout">
      <AppIcon name="alert" style="color: var(--danger-text)" />
      <span>{{ problemText }}<template v-if="rateLimit.active.value"> Tente de novo em {{ rateLimit.label.value }}.</template></span>
    </div>

    <form class="form" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="login-email" class="label">E-mail</label>
        <input
          id="login-email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="username"
          :placeholder="EMAIL_PLACEHOLDER"
          :aria-invalid="!!fieldErrors.email || undefined"
        >
        <span v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</span>
      </div>
      <div class="field">
        <div style="display: flex; align-items: baseline; gap: 8px">
          <label for="login-senha" class="label" style="flex: 1">Senha</label>
          <RouterLink :to="{ name: 'forgot-password', query: email ? { email } : {} }" class="section-link">Esqueci minha senha</RouterLink>
        </div>
        <div class="input-with-action">
          <input
            id="login-senha"
            v-model="password"
            class="input"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :aria-invalid="!!fieldErrors.password || undefined"
          >
          <button type="button" class="btn btn--icon" :aria-label="showPassword ? 'Esconder senha' : 'Mostrar senha'" :aria-pressed="showPassword" @click="showPassword = !showPassword">
            <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" />
          </button>
        </div>
        <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
      </div>
      <button type="submit" class="btn btn--primary btn--block" style="margin-top: 4px" :disabled="busy || rateLimit.active.value">
        {{ busy ? 'Entrando…' : rateLimit.active.value ? `Aguarde ${rateLimit.label.value}` : 'Continuar' }}
      </button>
    </form>

    <hr class="divider">
    <div style="display: flex; flex-direction: column; gap: 8px">
      <p class="muted">
        Ainda não tem conta?
        <RouterLink :to="{ name: 'register' }" style="font-weight: 600; text-decoration: none">Criar conta</RouterLink>
      </p>
      <p class="small muted">
        Criou a conta e não confirmou o e-mail?
        <RouterLink :to="{ name: 'confirm-email', query: email ? { email } : {} }" style="font-weight: 500; text-decoration: none">Digitar o código de confirmação</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
