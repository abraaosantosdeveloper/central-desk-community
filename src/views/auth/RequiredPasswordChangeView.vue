<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, errorMessage, meApi } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import AuthLayout from '@/components/AuthLayout.vue'
import { useLogout } from '@/composables/useLogout'
import { useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'
import { meetsPasswordRules } from '@/utils/password'

// Entrou com a senha temporária de um administrador: troca obrigatória antes de qualquer outra tela.

const auth = useAuthStore()
const toasts = useToastsStore()
const router = useRouter()
const logout = useLogout()

const current = ref('')
const newPassword = ref('')
const repeat = ref('')
const code = ref('')
const codeNeeded = ref(false)
const busy = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

async function sendCode() {
  try {
    const response = await meApi.sendPasswordCode()
    toasts.success(response.message)
  } catch (err) {
    toasts.error(errorMessage(err))
  }
}

async function submit() {
  if (busy.value) return
  error.value = ''
  const errors: Record<string, string> = {}
  if (!current.value) errors.currentPassword = 'Informe a senha temporária.'
  if (!meetsPasswordRules(newPassword.value)) errors.newPassword = '8 a 72 caracteres, com ao menos uma letra e um número.'
  if (newPassword.value !== repeat.value) errors.repeat = 'As senhas não são iguais.'
  fieldErrors.value = errors
  if (Object.keys(errors).length) return
  busy.value = true
  try {
    await auth.changePassword(current.value, newPassword.value, codeNeeded.value ? code.value : undefined)
    toasts.success('Senha criada. Tudo pronto!')
    await router.replace('/')
  } catch (err) {
    if (err instanceof ApiError) {
      fieldErrors.value = err.fieldErrors
      if (err.fieldErrors.code && !codeNeeded.value) {
        // Com a verificação em duas etapas ligada, a troca também pede um código do e-mail
        codeNeeded.value = true
        await sendCode()
      }
    }
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function leave() {
  await logout.confirm()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AuthLayout :width="400">
    <span class="auth-icon" aria-hidden="true"><AppIcon name="key" :size="24" :stroke-width="1.6" /></span>
    <div class="auth-head">
      <h1 class="auth-title">Defina sua nova senha</h1>
      <p class="muted">Um administrador redefiniu sua senha. Para continuar, troque a senha temporária por uma só sua.</p>
    </div>
    <form class="form" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="tro-atual" class="label">Senha temporária</label>
        <input id="tro-atual" v-model="current" class="input" type="password" autocomplete="current-password" :aria-invalid="!!fieldErrors.currentPassword || undefined">
        <span v-if="fieldErrors.currentPassword" class="field-error">{{ fieldErrors.currentPassword }}</span>
      </div>
      <div class="field">
        <label for="tro-nova" class="label">Nova senha</label>
        <input id="tro-nova" v-model="newPassword" class="input" type="password" autocomplete="new-password" :aria-invalid="!!fieldErrors.newPassword || undefined">
        <span v-if="fieldErrors.newPassword" class="field-error">{{ fieldErrors.newPassword }}</span>
        <span v-else class="hint">8 a 72 caracteres, com ao menos uma letra e um número.</span>
      </div>
      <div class="field">
        <label for="tro-repete" class="label">Repita a nova senha</label>
        <input id="tro-repete" v-model="repeat" class="input" type="password" autocomplete="new-password" :aria-invalid="!!fieldErrors.repeat || undefined">
        <span v-if="fieldErrors.repeat" class="field-error">{{ fieldErrors.repeat }}</span>
      </div>
      <div v-if="codeNeeded" class="field">
        <label for="tro-codigo" class="label">Código enviado por e-mail</label>
        <input id="tro-codigo" v-model="code" class="input input--code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" :aria-invalid="!!fieldErrors.code || undefined">
        <span v-if="fieldErrors.code" class="field-error">{{ fieldErrors.code }}</span>
        <button type="button" class="link-button" style="align-self: flex-start" @click="sendCode">Enviar outro código</button>
      </div>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn--primary btn--block" :disabled="busy">{{ busy ? 'Salvando…' : 'Salvar e continuar' }}</button>
    </form>
    <button type="button" class="link-button" style="align-self: flex-start" @click="leave">Sair</button>
  </AuthLayout>
</template>
