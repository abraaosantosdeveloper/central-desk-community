<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, authApi, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import AuthLayout from '@/components/AuthLayout.vue'
import { EMAIL_PLACEHOLDER } from '@/config'
import { useCountdown } from '@/composables/useCountdown'
import { normalizeCode, normalizeEmail } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'
import { meetsPasswordRules } from '@/utils/password'

// "Esqueci minha senha" em 3 etapas. A API responde igual exista a conta ou não.

const toasts = useToastsStore()
const countdown = useCountdown()
const route = useRoute()

const step = ref<1 | 2 | 3>(1)
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const code = ref('')
const newPassword = ref('')
const repeat = ref('')
const busy = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

const steps = computed(() => [
  { n: 1, label: '1. E-mail' },
  { n: 2, label: '2. Código e nova senha' },
  { n: 3, label: '3. Pronto' },
])

async function requestCode() {
  if (busy.value) return
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Informe o e-mail da sua conta.'
    return
  }
  busy.value = true
  try {
    await authApi.forgotPassword(normalizeEmail(email.value))
    step.value = 2
    countdown.start(60)
  } catch (err) {
    if (err instanceof ApiError && err.retryAfter) countdown.start(err.retryAfter)
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function resend() {
  try {
    const response = await authApi.forgotPassword(normalizeEmail(email.value))
    toasts.success(response.message)
    countdown.start(60)
  } catch (err) {
    if (err instanceof ApiError && err.retryAfter) countdown.start(err.retryAfter)
    toasts.error(errorMessage(err))
  }
}

async function reset() {
  if (busy.value) return
  error.value = ''
  const errors: Record<string, string> = {}
  if (normalizeCode(code.value).length !== 6) errors.code = 'Digite os 6 dígitos do código.'
  if (!meetsPasswordRules(newPassword.value)) errors.newPassword = '8 a 72 caracteres, com ao menos uma letra e um número.'
  if (newPassword.value !== repeat.value) errors.repeat = 'As senhas não são iguais.'
  fieldErrors.value = errors
  if (Object.keys(errors).length) return
  busy.value = true
  try {
    await authApi.resetPassword(normalizeEmail(email.value), normalizeCode(code.value), newPassword.value)
    step.value = 3
  } catch (err) {
    if (err instanceof ApiError) fieldErrors.value = err.fieldErrors
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout :width="400">
    <ol aria-label="Etapas" class="steps">
      <li v-for="item in steps" :key="item.n" :class="{ 'is-done': step >= item.n }" :aria-current="step === item.n ? 'step' : undefined">
        <span class="steps__bar" />{{ item.label }}
      </li>
    </ol>

    <template v-if="step === 1">
      <div class="auth-head">
        <h1 class="auth-title">Esqueci minha senha</h1>
        <p class="muted">Informe o e-mail da sua conta. Se ele estiver cadastrado, você recebe um código para criar uma nova senha.</p>
      </div>
      <form class="form" novalidate @submit.prevent="requestCode">
        <div class="field">
          <label for="rec-email" class="label">E-mail</label>
          <input id="rec-email" v-model="email" class="input" type="email" autocomplete="username" :placeholder="EMAIL_PLACEHOLDER">
        </div>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn--primary btn--block" :disabled="busy">{{ busy ? 'Enviando…' : 'Enviar código' }}</button>
      </form>
      <p class="small muted">Conta bloqueada? A senha só pode ser redefinida por um administrador.</p>
      <RouterLink :to="{ name: 'login' }" class="section-link">Voltar para o login</RouterLink>
    </template>

    <template v-else-if="step === 2">
      <div class="auth-head">
        <h1 class="auth-title">Crie uma nova senha</h1>
        <p class="muted">Digite o código enviado para {{ email }}. Ele vale por 10 minutos.</p>
      </div>
      <form class="form" novalidate @submit.prevent="reset">
        <div class="field">
          <label for="rec-codigo" class="label">Código de 6 dígitos</label>
          <input id="rec-codigo" v-model="code" class="input input--code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" :aria-invalid="!!fieldErrors.code || undefined">
          <span v-if="fieldErrors.code" class="field-error">{{ fieldErrors.code }}</span>
        </div>
        <div class="field">
          <label for="rec-nova" class="label">Nova senha</label>
          <input id="rec-nova" v-model="newPassword" class="input" type="password" autocomplete="new-password" :aria-invalid="!!fieldErrors.newPassword || undefined">
          <span v-if="fieldErrors.newPassword" class="field-error">{{ fieldErrors.newPassword }}</span>
          <span v-else class="hint">8 a 72 caracteres, com ao menos uma letra e um número.</span>
        </div>
        <div class="field">
          <label for="rec-repete" class="label">Repita a nova senha</label>
          <input id="rec-repete" v-model="repeat" class="input" type="password" autocomplete="new-password" :aria-invalid="!!fieldErrors.repeat || undefined">
          <span v-if="fieldErrors.repeat" class="field-error">{{ fieldErrors.repeat }}</span>
        </div>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn--primary btn--block" :disabled="busy">{{ busy ? 'Salvando…' : 'Salvar nova senha' }}</button>
      </form>
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px">
        <button type="button" class="link-button" :disabled="countdown.active.value" @click="resend">
          {{ countdown.active.value ? `Reenviar código em ${countdown.label.value}` : 'Reenviar código' }}
        </button>
        <button type="button" class="link-button" @click="step = 1">Usar outro e-mail</button>
      </div>
    </template>

    <template v-else>
      <span class="auth-icon" style="background: var(--success-tint); color: var(--success-text); border-radius: 24px" aria-hidden="true">
        <AppIcon name="check" :size="24" :stroke-width="2" />
      </span>
      <div class="auth-head">
        <h1 class="auth-title">Senha alterada</h1>
        <p class="muted">Por segurança, encerramos as sessões abertas e removemos os navegadores confiáveis. Entre de novo com a nova senha.</p>
      </div>
      <RouterLink :to="{ name: 'login' }" class="btn btn--primary btn--block">Ir para o login</RouterLink>
    </template>
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
