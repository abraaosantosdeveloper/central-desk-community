<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ApiError, errorMessage } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import AuthLayout from '@/components/AuthLayout.vue'
import { EMAIL_PLACEHOLDER, SUPPORT_TEAM_NAME } from '@/config'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { formatCpf, isValidCpf, onlyDigits } from '@/utils/cpf'
import { meetsPasswordRules, passwordRules } from '@/utils/password'

const auth = useAuthStore()
const catalog = useCatalogStore()
const router = useRouter()

const form = reactive({ fullName: '', cpf: '', departmentId: '', email: '', password: '' })
const showPassword = ref(false)
const busy = ref(false)
const generalError = ref('')
const fieldErrors = ref<Record<string, string>>({})
const loadError = ref('')

onMounted(async () => {
  try {
    await catalog.loadDepartments()
  } catch (error) {
    loadError.value = errorMessage(error)
  }
})

const departments = computed(() => [...catalog.departments].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
const selectedDepartment = computed(() => catalog.departments.find((d) => d.id === form.departmentId))
const needsApproval = computed(
  () => selectedDepartment.value?.name.trim().toLowerCase() === SUPPORT_TEAM_NAME.trim().toLowerCase(),
)
const rules = computed(() => passwordRules(form.password))

function onCpfInput(event: Event) {
  form.cpf = formatCpf((event.target as HTMLInputElement).value)
}

function validate(): boolean {
  const errors: Record<string, string> = {}
  if (!form.fullName.trim()) errors.fullName = 'Informe seu nome completo.'
  if (!isValidCpf(form.cpf)) errors.cpf = 'CPF inválido.'
  if (!form.departmentId) errors.departmentId = 'Escolha seu departamento.'
  const email = form.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Informe um e-mail válido.'
  if (!meetsPasswordRules(form.password)) errors.password = 'A senha ainda não atende às regras.'
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit() {
  if (busy.value) return
  generalError.value = ''
  if (!validate()) return
  busy.value = true
  try {
    const result = await auth.register({
      fullName: form.fullName,
      cpf: onlyDigits(form.cpf),
      email: form.email,
      password: form.password,
      departmentId: form.departmentId,
    })
    if (result === 'verify-email') await router.push({ name: 'confirm-email', query: { email: auth.pendingEmail } })
    else if (result === 'code-required') await router.push({ name: 'login-code' })
    else await router.replace('/')
  } catch (error) {
    if (error instanceof ApiError && Object.keys(error.fieldErrors).length) fieldErrors.value = error.fieldErrors
    generalError.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout :width="440">
    <div class="auth-head">
      <h1 class="auth-title">Criar conta</h1>
      <p class="muted">Depois do cadastro, enviamos um código para confirmar seu e-mail.</p>
    </div>

    <p v-if="generalError" role="alert" class="callout">
      <AppIcon name="alert" style="color: var(--danger-text)" />
      <span>{{ generalError }}</span>
    </p>

    <form class="form" style="gap: 18px" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="cad-nome" class="label">Nome completo</label>
        <input id="cad-nome" v-model="form.fullName" class="input" type="text" autocomplete="name" maxlength="150" :aria-invalid="!!fieldErrors.fullName || undefined">
        <span v-if="fieldErrors.fullName" class="field-error">{{ fieldErrors.fullName }}</span>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 18px 12px">
        <div class="field" style="flex: 1 1 160px">
          <label for="cad-cpf" class="label">CPF</label>
          <input
            id="cad-cpf"
            :value="form.cpf"
            class="input"
            type="text"
            inputmode="numeric"
            placeholder="000.000.000-00"
            :aria-invalid="!!fieldErrors.cpf || undefined"
            @input="onCpfInput"
          >
          <span v-if="fieldErrors.cpf" class="field-error">{{ fieldErrors.cpf }}</span>
        </div>
        <div class="field" style="flex: 1 1 200px">
          <label for="cad-depto" class="label">Departamento</label>
          <select id="cad-depto" v-model="form.departmentId" class="select" :aria-invalid="!!fieldErrors.departmentId || undefined">
            <option value="" disabled>Escolha…</option>
            <option v-for="department in departments" :key="department.id" :value="department.id">{{ department.name }}</option>
          </select>
          <span v-if="fieldErrors.departmentId" class="field-error">{{ fieldErrors.departmentId }}</span>
          <span v-else-if="loadError" class="field-error">{{ loadError }}</span>
        </div>
      </div>

      <div v-if="needsApproval" class="callout">
        <AppIcon name="info" style="color: var(--text-2)" />
        <span style="color: var(--text-2)">
          Entrar em <strong style="color: var(--text); font-weight: 600">{{ SUPPORT_TEAM_NAME }}</strong> depende da aprovação de um administrador.
          Até lá, sua conta fica no departamento Geral e você já pode abrir chamados.
        </span>
      </div>

      <div class="field">
        <label for="cad-email" class="label">E-mail</label>
        <input id="cad-email" v-model="form.email" class="input" type="email" autocomplete="email" :placeholder="EMAIL_PLACEHOLDER" aria-describedby="cad-email-ajuda" :aria-invalid="!!fieldErrors.email || undefined">
        <span v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</span>
        <span v-else id="cad-email-ajuda" class="hint">Você vai receber um código neste e-mail para confirmar a conta.</span>
      </div>

      <div class="field">
        <label for="cad-senha" class="label">Senha</label>
        <div class="input-with-action">
          <input id="cad-senha" v-model="form.password" class="input" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" aria-describedby="cad-senha-regras" :aria-invalid="!!fieldErrors.password || undefined">
          <button type="button" class="btn btn--icon" :aria-label="showPassword ? 'Esconder senha' : 'Mostrar senha'" @click="showPassword = !showPassword">
            <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" />
          </button>
        </div>
        <ul id="cad-senha-regras" class="rules">
          <li :class="{ 'is-met': rules.length }"><AppIcon :name="rules.length ? 'check' : 'circle'" :size="16" :stroke-width="2.2" />Entre 8 e 72 caracteres</li>
          <li :class="{ 'is-met': rules.letter }"><AppIcon :name="rules.letter ? 'check' : 'circle'" :size="16" :stroke-width="2.2" />Ao menos uma letra</li>
          <li :class="{ 'is-met': rules.digit }"><AppIcon :name="rules.digit ? 'check' : 'circle'" :size="16" :stroke-width="2.2" />Ao menos um número</li>
        </ul>
        <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
      </div>

      <button type="submit" class="btn btn--primary btn--block" style="margin-top: 4px" :disabled="busy">{{ busy ? 'Criando…' : 'Criar conta' }}</button>
    </form>

    <hr class="divider">
    <p class="muted">Já tem conta? <RouterLink :to="{ name: 'login' }" style="font-weight: 600; text-decoration: none">Entrar</RouterLink></p>
  </AuthLayout>
</template>
