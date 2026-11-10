<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ApiError,
  errorMessage,
  meApi,
  securityApi,
  type TrustedDevice,
  type TwoFactorStatus,
} from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useCountdown } from '@/composables/useCountdown'
import { normalizeCode, roleLabel, useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'
import { formatAgo, formatDate } from '@/utils/format'
import { meetsPasswordRules } from '@/utils/password'

const auth = useAuthStore()
const toasts = useToastsStore()
const router = useRouter()

// --- Dados pessoais ---
const fullName = ref(auth.currentUser?.fullName ?? '')
const savingName = ref(false)
const nameError = ref('')

async function saveName() {
  if (savingName.value) return
  if (!fullName.value.trim()) {
    nameError.value = 'Informe seu nome.'
    return
  }
  nameError.value = ''
  savingName.value = true
  try {
    await auth.rename(fullName.value)
    toasts.success('Nome atualizado.')
  } catch (err) {
    nameError.value = err instanceof ApiError && err.fieldErrors.fullName ? err.fieldErrors.fullName : errorMessage(err)
  } finally {
    savingName.value = false
  }
}

// --- Segurança ---
const twoFactor = ref<TwoFactorStatus | null>(null)
const devices = ref<TrustedDevice[]>([])
const securityError = ref('')

async function loadSecurity() {
  securityError.value = ''
  try {
    const [status, list] = await Promise.all([securityApi.twoFactor(), securityApi.trustedDevices()])
    twoFactor.value = status
    devices.value = list
  } catch (err) {
    securityError.value = errorMessage(err)
  }
}
onMounted(loadSecurity)

type Dialog = 'password' | 'disable-tfa' | 'remove-all' | 'close-account' | null
const dialog = ref<Dialog>(null)
const busy = ref(false)
const dialogError = ref('')
const fieldErrors = ref<Record<string, string>>({})
const countdown = useCountdown()

const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const code = ref('')

function open(kind: Dialog) {
  dialog.value = kind
  dialogError.value = ''
  fieldErrors.value = {}
  currentPassword.value = ''
  newPassword.value = ''
  repeatPassword.value = ''
  code.value = ''
}

function closeDialog() {
  if (!busy.value) dialog.value = null
}

async function sendCode(kind: 'password' | 'tfa') {
  try {
    const response = kind === 'password' ? await meApi.sendPasswordCode() : await securityApi.sendDisableCode()
    toasts.success(response.message)
    countdown.start(60)
  } catch (err) {
    if (err instanceof ApiError && err.retryAfter) countdown.start(err.retryAfter)
    toasts.error(errorMessage(err))
  }
}

async function changePassword() {
  if (busy.value) return
  const errors: Record<string, string> = {}
  if (!currentPassword.value) errors.currentPassword = 'Informe a senha atual.'
  if (!meetsPasswordRules(newPassword.value)) errors.newPassword = '8 a 72 caracteres, com ao menos uma letra e um número.'
  if (newPassword.value !== repeatPassword.value) errors.repeat = 'As senhas não são iguais.'
  if (twoFactor.value?.enabled && normalizeCode(code.value).length !== 6) errors.code = 'Digite o código enviado por e-mail.'
  fieldErrors.value = errors
  if (Object.keys(errors).length) return
  busy.value = true
  dialogError.value = ''
  try {
    await auth.changePassword(currentPassword.value, newPassword.value, twoFactor.value?.enabled ? code.value : undefined)
    toasts.success('Senha alterada. As outras sessões foram encerradas.')
    dialog.value = null
    void loadSecurity()
  } catch (err) {
    if (err instanceof ApiError) fieldErrors.value = err.fieldErrors
    dialogError.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function toggleTwoFactor() {
  if (!twoFactor.value || twoFactor.value.mandatory) return
  if (twoFactor.value.enabled) {
    open('disable-tfa')
    return
  }
  try {
    twoFactor.value = await securityApi.enableTwoFactor()
    toasts.success('Verificação em duas etapas ligada.')
  } catch (err) {
    toasts.error(errorMessage(err))
  }
}

async function disableTwoFactor() {
  if (busy.value) return
  const errors: Record<string, string> = {}
  if (!currentPassword.value) errors.currentPassword = 'Informe sua senha.'
  if (normalizeCode(code.value).length !== 6) errors.code = 'Digite o código enviado por e-mail.'
  fieldErrors.value = errors
  if (Object.keys(errors).length) return
  busy.value = true
  dialogError.value = ''
  try {
    twoFactor.value = await securityApi.disableTwoFactor(currentPassword.value, normalizeCode(code.value))
    toasts.success('Verificação em duas etapas desligada.')
    dialog.value = null
    void loadSecurity()
  } catch (err) {
    if (err instanceof ApiError) fieldErrors.value = err.fieldErrors
    dialogError.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

async function removeDevice(device: TrustedDevice) {
  try {
    await securityApi.removeTrustedDevice(device.id)
    devices.value = devices.value.filter((item) => item.id !== device.id)
    toasts.success(`${device.label} removido.`)
  } catch (err) {
    toasts.error(errorMessage(err))
  }
}

async function removeAllDevices() {
  if (busy.value) return
  busy.value = true
  try {
    await securityApi.removeAllTrustedDevices()
    devices.value = []
    toasts.success('Navegadores confiáveis removidos.')
    dialog.value = null
  } catch (err) {
    toasts.error(errorMessage(err))
  } finally {
    busy.value = false
  }
}

async function closeAccount() {
  if (busy.value) return
  if (!currentPassword.value) {
    fieldErrors.value = { password: 'Digite sua senha para confirmar.' }
    return
  }
  busy.value = true
  dialogError.value = ''
  try {
    await auth.closeAccount(currentPassword.value)
    dialog.value = null
    await router.replace({ name: 'login' })
  } catch (err) {
    if (err instanceof ApiError) fieldErrors.value = err.fieldErrors
    dialogError.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

function deviceIcon(label: string): 'phone' | 'monitor' {
  return /iphone|android|celular|mobile|ipad/i.test(label) ? 'phone' : 'monitor'
}
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Meu perfil' }]" />

  <div class="page page--narrow" style="max-width: 760px; gap: 36px; padding-bottom: 80px">
    <div style="display: flex; align-items: center; gap: 16px">
      <UserAvatar :name="auth.currentUser?.fullName ?? ''" :size="64" />
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">
        <h1 class="page-title" style="font-size: 32px; line-height: 40px">{{ auth.currentUser?.fullName }}</h1>
        <span class="muted">{{ roleLabel(auth.currentUser) }} · {{ auth.currentUser?.departmentName }}</span>
      </div>
    </div>

    <section aria-labelledby="dados" class="profile-section">
      <h2 id="dados" class="profile-section__title">Dados pessoais</h2>
      <form class="name-row" novalidate @submit.prevent="saveName">
        <div class="field" style="flex: 1 1 280px">
          <label for="pf-nome" class="label">Nome completo</label>
          <input id="pf-nome" v-model="fullName" class="input" type="text" autocomplete="name" maxlength="150" :aria-invalid="!!nameError || undefined">
          <span v-if="nameError" class="field-error">{{ nameError }}</span>
        </div>
        <button type="submit" class="btn" :disabled="savingName || fullName.trim() === auth.currentUser?.fullName">{{ savingName ? 'Salvando…' : 'Salvar nome' }}</button>
      </form>
      <dl class="props props--compact">
        <dt>E-mail</dt><dd>{{ auth.currentUser?.email }}</dd>
        <dt>Departamento</dt><dd>{{ auth.currentUser?.departmentName }}</dd>
        <dt>Conta criada</dt><dd>{{ auth.currentUser ? formatDate(auth.currentUser.createdAt) : '' }}</dd>
      </dl>
      <p v-if="auth.currentUser?.departmentApprovalPending" class="callout small">
        <AppIcon name="clock" :size="16" />
        <span>Seu pedido para entrar em {{ SUPPORT_TEAM_NAME }} aguarda um administrador.</span>
      </p>
      <p class="small muted">Para corrigir e-mail, CPF ou departamento, peça a um administrador.</p>
    </section>

    <section aria-labelledby="seguranca" class="profile-section" style="gap: 4px">
      <h2 id="seguranca" class="profile-section__title" style="margin-bottom: 6px">Segurança</h2>
      <p v-if="securityError" class="callout small" role="alert"><AppIcon name="alert" :size="16" /><span>{{ securityError }}</span></p>

      <div class="setting">
        <div class="setting__text">
          <span style="font-weight: 500">Senha</span>
          <span class="small muted">Trocar a senha encerra as outras sessões e remove os navegadores confiáveis.</span>
        </div>
        <button type="button" class="btn" @click="open('password')">Trocar senha</button>
      </div>

      <div class="setting">
        <div class="setting__text">
          <span id="tfa-rotulo" style="font-weight: 500">Verificação em duas etapas</span>
          <span id="tfa-ajuda" class="small muted">
            <template v-if="!twoFactor">Carregando…</template>
            <template v-else-if="twoFactor.mandatory">Ligada. Obrigatória para administradores.</template>
            <template v-else-if="twoFactor.enabled">Ligada. Ao entrar em um navegador novo, pedimos um código enviado por e-mail.</template>
            <template v-else>Desligada. Ligue para pedir um código por e-mail ao entrar em navegadores novos.</template>
          </span>
        </div>
        <button
          type="button"
          role="switch"
          class="switch"
          :aria-checked="twoFactor?.enabled ?? false"
          aria-labelledby="tfa-rotulo"
          aria-describedby="tfa-ajuda"
          :disabled="!twoFactor || twoFactor.mandatory"
          @click="toggleTwoFactor"
        ><span /></button>
      </div>

      <div class="setting" style="flex-direction: column; align-items: stretch; border-bottom: 0">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">
          <div class="setting__text">
            <span style="font-weight: 500">Navegadores confiáveis</span>
            <span class="small muted">Nestes navegadores, o código por e-mail não é pedido por 30 dias.</span>
          </div>
          <button v-if="devices.length" type="button" class="btn btn--ghost-danger" @click="open('remove-all')">Remover todos</button>
        </div>
        <p v-if="!devices.length" class="small muted" style="padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-md)">Nenhum navegador confiável no momento.</p>
        <ul v-else class="devices">
          <li v-for="device in devices" :key="device.id">
            <AppIcon :name="deviceIcon(device.label)" :size="20" :stroke-width="1.6" style="color: var(--text-2)" />
            <span style="flex: 1 1 200px; display: flex; flex-direction: column; min-width: 0">
              <span style="font-weight: 500" class="truncate">{{ device.label }}</span>
              <span class="xsmall muted">{{ device.lastUsedAt ? `Usado ${formatAgo(device.lastUsedAt)}` : 'Ainda não usado' }} · vence em {{ formatDate(device.expiresAt) }}</span>
            </span>
            <button type="button" class="btn btn--sm" @click="removeDevice(device)">Remover</button>
          </li>
        </ul>
      </div>
    </section>

    <section aria-labelledby="risco" class="danger-zone">
      <h2 id="risco" style="font-size: 16px; font-weight: 600; color: var(--danger-text)">Encerrar minha conta</h2>
      <p style="color: var(--text-2)">Seus dados pessoais são anonimizados e o login deixa de funcionar. Os chamados continuam no histórico, sem o seu nome. Não dá para desfazer.</p>
      <button type="button" class="btn btn--danger" style="align-self: flex-start" @click="open('close-account')">Encerrar conta</button>
    </section>
  </div>

  <BaseModal :open="dialog === 'password'" title="Trocar senha" description="As outras sessões são encerradas; esta continua aberta." @close="closeDialog">
    <form class="form" novalidate @submit.prevent="changePassword">
      <div class="field">
        <label for="pw-atual" class="label">Senha atual</label>
        <input id="pw-atual" v-model="currentPassword" class="input" type="password" autocomplete="current-password" :aria-invalid="!!fieldErrors.currentPassword || undefined">
        <span v-if="fieldErrors.currentPassword" class="field-error">{{ fieldErrors.currentPassword }}</span>
      </div>
      <div class="field">
        <label for="pw-nova" class="label">Nova senha</label>
        <input id="pw-nova" v-model="newPassword" class="input" type="password" autocomplete="new-password" :aria-invalid="!!fieldErrors.newPassword || undefined">
        <span v-if="fieldErrors.newPassword" class="field-error">{{ fieldErrors.newPassword }}</span>
        <span v-else class="hint">8 a 72 caracteres, com ao menos uma letra e um número.</span>
      </div>
      <div class="field">
        <label for="pw-repete" class="label">Repita a nova senha</label>
        <input id="pw-repete" v-model="repeatPassword" class="input" type="password" autocomplete="new-password" :aria-invalid="!!fieldErrors.repeat || undefined">
        <span v-if="fieldErrors.repeat" class="field-error">{{ fieldErrors.repeat }}</span>
      </div>
      <div v-if="twoFactor?.enabled" class="field">
        <label for="pw-codigo" class="label">Código enviado por e-mail</label>
        <div style="display: flex; gap: 8px">
          <input id="pw-codigo" v-model="code" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" style="flex: 1" :aria-invalid="!!fieldErrors.code || undefined">
          <button type="button" class="btn" :disabled="countdown.active.value" @click="sendCode('password')">{{ countdown.active.value ? countdown.label.value : 'Enviar código' }}</button>
        </div>
        <span v-if="fieldErrors.code" class="field-error">{{ fieldErrors.code }}</span>
      </div>
      <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
      <div class="modal-actions">
        <button type="button" class="btn" :disabled="busy" @click="closeDialog">Cancelar</button>
        <button type="submit" class="btn btn--primary" :disabled="busy">{{ busy ? 'Salvando…' : 'Trocar senha' }}</button>
      </div>
    </form>
  </BaseModal>

  <BaseModal
    :open="dialog === 'disable-tfa'"
    title="Desligar a verificação em duas etapas"
    description="Confirme com sua senha e o código que enviamos para seu e-mail. Os navegadores confiáveis serão removidos."
    @close="closeDialog"
  >
    <form class="form" novalidate @submit.prevent="disableTwoFactor">
      <div class="field">
        <label for="tfa-senha" class="label">Senha atual</label>
        <input id="tfa-senha" v-model="currentPassword" class="input" type="password" autocomplete="current-password" :aria-invalid="!!fieldErrors.currentPassword || undefined">
        <span v-if="fieldErrors.currentPassword" class="field-error">{{ fieldErrors.currentPassword }}</span>
      </div>
      <div class="field">
        <label for="tfa-codigo" class="label">Código de 6 dígitos</label>
        <div style="display: flex; gap: 8px">
          <input id="tfa-codigo" v-model="code" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" style="flex: 1; letter-spacing: 0.2em" :aria-invalid="!!fieldErrors.code || undefined">
          <button type="button" class="btn" :disabled="countdown.active.value" @click="sendCode('tfa')">{{ countdown.active.value ? countdown.label.value : 'Enviar código' }}</button>
        </div>
        <span v-if="fieldErrors.code" class="field-error">{{ fieldErrors.code }}</span>
      </div>
      <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
      <div class="modal-actions">
        <button type="button" class="btn" :disabled="busy" @click="closeDialog">Manter ligada</button>
        <button type="submit" class="btn btn--danger" :disabled="busy">{{ busy ? 'Desligando…' : 'Desligar' }}</button>
      </div>
    </form>
  </BaseModal>

  <ConfirmDialog
    :open="dialog === 'remove-all'"
    title="Remover todos os navegadores confiáveis?"
    description="Na próxima vez que você entrar em qualquer um deles, pediremos o código por e-mail."
    confirm-label="Remover todos"
    :busy="busy"
    @confirm="removeAllDevices"
    @cancel="closeDialog"
  />

  <BaseModal
    :open="dialog === 'close-account'"
    tone="danger"
    title="Encerrar minha conta"
    description="Seus dados pessoais serão anonimizados e você sai de todos os dispositivos. Esta ação não pode ser desfeita."
    @close="closeDialog"
  >
    <form class="form" novalidate @submit.prevent="closeAccount">
      <div class="field">
        <label for="enc-senha" class="label">Digite sua senha para confirmar</label>
        <input id="enc-senha" v-model="currentPassword" class="input" type="password" autocomplete="current-password" :aria-invalid="!!fieldErrors.password || undefined">
        <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
      </div>
      <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
      <div class="modal-actions">
        <button type="button" class="btn" :disabled="busy" @click="closeDialog">Cancelar</button>
        <button type="submit" class="btn btn--danger" :disabled="busy">{{ busy ? 'Encerrando…' : 'Encerrar conta' }}</button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.profile-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile-section__title {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  font-size: 16px;
  font-weight: 600;
}
.name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  margin: 0;
}
.setting {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.setting__text {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.devices {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.devices li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}
.devices li:last-child {
  border-bottom: 0;
}
.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-lg);
}
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
