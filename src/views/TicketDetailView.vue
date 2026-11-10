<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ApiError,
  commentsApi,
  errorMessage,
  ticketsApi,
  type Assignee,
  type Comment,
  type TicketDetail,
} from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'
import CategoryLabel from '@/components/CategoryLabel.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import PriorityLabel from '@/components/PriorityLabel.vue'
import StateMessage from '@/components/StateMessage.vue'
import StatusTag from '@/components/StatusTag.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useRealtimeStore } from '@/stores/realtime'
import { useToastsStore } from '@/stores/toasts'
import { formatDuration, formatShortTime } from '@/utils/format'
import {
  COMMENT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  REOPEN_MAX_LENGTH,
  REOPEN_MIN_LENGTH,
  RESOLUTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  reopenDeadline,
  ticketCode,
  withinReopenWindow,
} from '@/utils/ticket'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()
const realtime = useRealtimeStore()
const activity = useActivityStore()
const toasts = useToastsStore()

const ticketId = String(route.params.id)

const ticket = ref<TicketDetail | null>(null)
const comments = ref<Comment[]>([])
const loading = ref(true)
const error = ref('')
const commentsError = ref('')

const message = ref('')
const sending = ref(false)
const acting = ref(false)

type Dialog = 'close' | 'reassign' | 'reopen' | 'edit' | null
const dialog = ref<Dialog>(null)
const resolution = ref('')
const reopenReason = ref('')
const dialogError = ref('')
const assignees = ref<Assignee[]>([])
const assigneesLoading = ref(false)
const chosenAssignee = ref('')
const editForm = reactive({ title: '', description: '', categoryId: '', priorityId: 0 })
const editErrors = ref<Record<string, string>>({})

const me = computed(() => auth.currentUser?.id)
const isRequester = computed(() => ticket.value?.requesterId === me.value)
const isAssignee = computed(() => !!ticket.value?.assigneeId && ticket.value.assigneeId === me.value)
const isClosed = computed(() => ticket.value?.status === 'CLOSED')

const canAssume = computed(
  () => ticket.value?.status === 'OPEN' && auth.canHandleTickets && (!isRequester.value || auth.canTakeOwnTickets),
)
const canReassign = computed(
  () => !isClosed.value && auth.canHandleTickets && (isAssignee.value || auth.isAdmin),
)
const canClose = computed(
  () => !isClosed.value && auth.canHandleTickets && (!isRequester.value || isAssignee.value),
)
const canReopen = computed(
  () => isClosed.value && (isRequester.value || auth.isAdmin) && withinReopenWindow(ticket.value?.closedAt ?? null),
)
const canEdit = computed(() => isRequester.value && ticket.value?.status === 'OPEN')
const canComment = computed(() => !isClosed.value && (isRequester.value || isAssignee.value))

/** O outro lado da conversa, para o texto do campo de mensagem. */
const counterpart = computed(() => {
  if (!ticket.value) return ''
  if (isRequester.value) return ticket.value.assigneeName ?? ''
  return ticket.value.requesterName
})

const responseTime = computed(() => {
  if (!ticket.value?.assignedAt) return ''
  return formatDuration(new Date(ticket.value.assignedAt).getTime() - new Date(ticket.value.createdAt).getTime())
})

const timeline = computed(() => {
  const value = ticket.value
  if (!value) return []
  const events: { label: string; at: string; note?: string }[] = [
    { label: `Aberto por ${value.requesterName}`, at: value.createdAt },
  ]
  if (value.assignedAt && value.assigneeName) {
    events.push({ label: `Com ${value.assigneeName}`, at: value.assignedAt, note: 'responsável atual' })
  }
  if (value.closedAt) {
    events.push({ label: `Encerrado por ${value.closedByName ?? '—'}`, at: value.closedAt })
  }
  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
})

const reopenUntil = computed(() =>
  ticket.value?.closedAt
    ? reopenDeadline(ticket.value.closedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
    : '',
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    ticket.value = await ticketsApi.get(ticketId)
    activity.forgetNew(ticketId)
    document.title = `${ticketCode(ticket.value)} ${ticket.value.title} · CentralDesk`
    await loadComments()
  } catch (err) {
    error.value = err instanceof ApiError && err.status === 404 ? 'Chamado não encontrado, ou você não tem acesso a ele.' : errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  commentsError.value = ''
  try {
    comments.value = await commentsApi.list(ticketId)
  } catch (err) {
    commentsError.value = errorMessage(err)
  }
}

const stops: (() => void)[] = []
onMounted(() => {
  void load()
  void catalog.loadTicketOptions().catch(() => undefined)
  stops.push(
    realtime.on('comment.created', (comment) => {
      if (comment.ticketId !== ticketId) return
      if (!comments.value.some((existing) => existing.id === comment.id)) comments.value = [...comments.value, comment]
      // Um comentário de reabertura muda o chamado: recarrega o cabeçalho
      void ticketsApi.get(ticketId).then((fresh) => (ticket.value = fresh), () => undefined)
    }),
    realtime.onConnected(() => void loadComments()),
  )
})
onUnmounted(() => stops.forEach((stop) => stop()))

async function sendComment() {
  const content = message.value.trim()
  if (!content || sending.value) return
  sending.value = true
  try {
    const created = await commentsApi.create(ticketId, content)
    if (!comments.value.some((existing) => existing.id === created.id)) comments.value = [...comments.value, created]
    message.value = ''
  } catch (err) {
    toasts.error(errorMessage(err))
  } finally {
    sending.value = false
  }
}

async function run(action: () => Promise<TicketDetail>, success: string) {
  if (acting.value) return false
  acting.value = true
  dialogError.value = ''
  try {
    ticket.value = await action()
    toasts.success(success)
    dialog.value = null
    void loadComments()
    return true
  } catch (err) {
    if (dialog.value) dialogError.value = err instanceof ApiError && Object.values(err.fieldErrors)[0] ? Object.values(err.fieldErrors)[0]! : errorMessage(err)
    else toasts.error(errorMessage(err))
    if (err instanceof ApiError && (err.status === 409 || err.status === 404)) void load()
    return false
  } finally {
    acting.value = false
  }
}

function assume() {
  void run(() => ticketsApi.assign(ticketId), 'Você assumiu o chamado.')
}

function openClose() {
  resolution.value = ''
  dialogError.value = ''
  dialog.value = 'close'
}

function submitClose() {
  if (!resolution.value.trim()) {
    dialogError.value = 'Conte o que foi feito: a resolução é obrigatória.'
    return
  }
  void run(() => ticketsApi.close(ticketId, resolution.value.trim()), 'Chamado encerrado.')
}

async function openReassign() {
  dialogError.value = ''
  chosenAssignee.value = ''
  dialog.value = 'reassign'
  assigneesLoading.value = true
  try {
    assignees.value = await ticketsApi.assignees()
  } catch (err) {
    dialogError.value = errorMessage(err)
  } finally {
    assigneesLoading.value = false
  }
}

function submitReassign() {
  if (!chosenAssignee.value) {
    dialogError.value = 'Escolha quem vai assumir.'
    return
  }
  const name = assignees.value.find((person) => person.id === chosenAssignee.value)?.fullName ?? ''
  void run(() => ticketsApi.reassign(ticketId, chosenAssignee.value), `Chamado reatribuído para ${name}.`)
}

function openReopen() {
  reopenReason.value = ''
  dialogError.value = ''
  dialog.value = 'reopen'
}

function submitReopen() {
  const reason = reopenReason.value.trim()
  if (reason.length < REOPEN_MIN_LENGTH) {
    dialogError.value = `Explique em pelo menos ${REOPEN_MIN_LENGTH} caracteres o que ainda não está resolvido.`
    return
  }
  void run(() => ticketsApi.reopen(ticketId, reason), 'Chamado reaberto.')
}

function openEdit() {
  if (!ticket.value) return
  editForm.title = ticket.value.title
  editForm.description = ticket.value.description
  editForm.categoryId = ticket.value.category.id
  editForm.priorityId = ticket.value.priority.id
  editErrors.value = {}
  dialogError.value = ''
  dialog.value = 'edit'
}

async function submitEdit() {
  if (!editForm.title.trim()) {
    editErrors.value = { title: 'Informe o título.' }
    return
  }
  const ok = await run(
    () =>
      ticketsApi.update(ticketId, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        categoryId: editForm.categoryId,
        priorityId: editForm.priorityId,
      }),
    'Chamado atualizado.',
  )
  if (!ok) editErrors.value = {}
}

function closeDialog() {
  if (!acting.value) dialog.value = null
}

async function focusComposer() {
  await nextTick()
  document.getElementById('comentario')?.focus()
}

function back() {
  if (window.history.length > 1) router.back()
  else void router.push({ name: 'home' })
}
</script>

<template>
  <PageTopbar
    :crumbs="[
      { label: isRequester ? 'Meus chamados' : 'Chamados', to: isRequester ? { name: 'mine' } : auth.canHandleTickets ? { name: 'board' } : { name: 'mine' } },
      { label: ticket ? ticketCode(ticket) : 'Chamado' },
    ]"
  >
    <template v-if="ticket">
      <button v-if="canEdit" type="button" class="btn" @click="openEdit"><AppIcon name="edit" :size="16" :stroke-width="1.8" />Editar</button>
      <button v-if="canAssume" type="button" class="btn btn--primary" :disabled="acting" @click="assume">{{ acting ? 'Assumindo…' : 'Assumir chamado' }}</button>
      <button v-if="canReassign" type="button" class="btn" @click="openReassign"><AppIcon name="reassign" :size="16" :stroke-width="1.8" />Reatribuir</button>
      <button v-if="canClose" type="button" class="btn" :class="{ 'btn--primary': !canAssume }" @click="openClose"><AppIcon name="check" :size="16" :stroke-width="2" />Encerrar chamado</button>
      <button v-if="canReopen" type="button" class="btn btn--primary" @click="openReopen"><AppIcon name="reopen" :size="16" :stroke-width="1.8" />Reabrir chamado</button>
    </template>
  </PageTopbar>

  <div class="page page--medium" style="padding-top: 32px">
    <button type="button" class="link-button mobile-back" @click="back"><AppIcon name="chevronLeft" :size="16" />Voltar</button>

    <StateMessage v-if="loading && !ticket" state="loading" />
    <StateMessage v-else-if="error" state="error" :message="error" @retry="load" />

    <div v-else-if="ticket" class="row-wrap" style="gap: 48px">
      <article style="flex: 3 1 520px; min-width: 0; display: flex; flex-direction: column; gap: 24px">
        <div style="display: flex; flex-direction: column; gap: 10px">
          <span class="small muted">Chamado {{ ticketCode(ticket) }}</span>
          <h1 class="page-title" style="font-size: 34px; line-height: 42px">{{ ticket.title }}</h1>
        </div>

        <dl class="props">
          <dt><AppIcon name="clock" :size="16" />Situação</dt>
          <dd><StatusTag :status="ticket.status" /></dd>
          <dt><AppIcon name="priority" :size="16" />Prioridade</dt>
          <dd><PriorityLabel :priority="ticket.priority" /></dd>
          <dt><AppIcon name="tag" :size="16" />Categoria</dt>
          <dd style="min-width: 0"><CategoryLabel :category="ticket.category" /></dd>
          <dt><AppIcon name="building" :size="16" />Setor de destino</dt>
          <dd>{{ ticket.targetDepartment?.name ?? '—' }}</dd>
          <dt><AppIcon name="user" :size="16" />Solicitante</dt>
          <dd>
            <UserAvatar :name="ticket.requesterName" :size="22" />{{ ticket.requesterName }}
            <span class="muted">{{ isRequester ? '(você)' : '' }} · {{ ticket.originDepartment?.name ?? '—' }}</span>
          </dd>
          <dt><AppIcon name="userCheck" :size="16" />Responsável</dt>
          <dd>
            <template v-if="ticket.assigneeName">
              <UserAvatar :name="ticket.assigneeName" :size="22" />{{ ticket.assigneeName }}
              <span v-if="isAssignee" class="muted">(você)</span>
            </template>
            <span v-else class="muted">Ninguém ainda: o chamado está na fila</span>
          </dd>
          <dt><AppIcon name="calendar" :size="16" />Aberto em</dt>
          <dd>{{ formatShortTime(ticket.createdAt) }}<span v-if="responseTime" class="muted">· assumido em {{ responseTime }}</span></dd>
        </dl>

        <p v-if="isRequester && ticket.status === 'OPEN' && !auth.canTakeOwnTickets && auth.canHandleTickets" class="callout small">
          <AppIcon name="info" :size="16" />
          <span>Você abriu este chamado, então outra pessoa da equipe precisa assumi-lo.</span>
        </p>

        <hr class="divider">

        <section style="display: flex; flex-direction: column; gap: 10px">
          <h2 class="section-title">Descrição</h2>
          <p class="pre-line" style="line-height: 24px">{{ ticket.description }}</p>
        </section>

        <section v-if="isClosed" class="card card--muted" style="display: flex; flex-direction: column; gap: 10px; padding: 16px">
          <h2 class="section-title" style="display: flex; align-items: center; gap: 8px; font-size: 15px">
            <AppIcon name="check" :size="18" :stroke-width="2" style="color: var(--success-text)" />Resolução
          </h2>
          <p class="pre-line" style="line-height: 22px">{{ ticket.resolution || 'Encerrado sem registro do que foi feito.' }}</p>
          <span class="small muted">
            Encerrado por {{ ticket.closedByName ?? '—' }} em {{ ticket.closedAt ? formatShortTime(ticket.closedAt) : '—' }}
            <template v-if="canReopen"> · pode ser reaberto até {{ reopenUntil }}</template>
          </span>
        </section>

        <section aria-labelledby="conversa" style="display: flex; flex-direction: column; gap: 16px">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <h2 id="conversa" class="section-title" style="flex: 1">Conversa</h2>
            <span class="xsmall muted" style="display: inline-flex; align-items: center; gap: 6px">
              <AppIcon name="lock" :size="14" :stroke-width="1.8" />Entre solicitante e responsável · guardada cifrada
            </span>
          </div>

          <StateMessage v-if="commentsError" state="error" :message="commentsError" @retry="loadComments" />
          <p v-else-if="!comments.length" class="small muted">
            Nenhuma mensagem ainda.
            <button v-if="canComment" type="button" class="link-button" style="min-height: 0" @click="focusComposer">Escrever a primeira</button>
          </p>
          <ol v-else class="comments">
            <li v-for="comment in comments" :key="comment.id">
              <UserAvatar :name="comment.authorName" />
              <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">
                <span class="small">
                  <strong style="font-weight: 600">{{ comment.authorName }}</strong>
                  <span class="muted"> {{ formatShortTime(comment.createdAt) }}</span>
                </span>
                <p class="pre-line" style="line-height: 22px; overflow-wrap: anywhere">{{ comment.content }}</p>
              </div>
            </li>
          </ol>

          <form v-if="canComment" class="composer" @submit.prevent="sendComment">
            <label for="comentario" class="sr-only">Escrever mensagem</label>
            <textarea
              id="comentario"
              v-model="message"
              rows="3"
              :maxlength="COMMENT_MAX_LENGTH"
              :placeholder="counterpart ? `Escreva uma mensagem para ${counterpart.split(' ')[0]}…` : 'Escreva uma mensagem…'"
              @keydown.ctrl.enter="sendComment"
              @keydown.meta.enter="sendComment"
            />
            <div style="display: flex; align-items: center; gap: 8px">
              <span class="xsmall muted" style="flex: 1">Ctrl + Enter envia.</span>
              <button type="submit" class="btn btn--dark" style="min-height: 40px" :disabled="sending || !message.trim()">{{ sending ? 'Enviando…' : 'Enviar' }}</button>
            </div>
          </form>
          <p v-else-if="isClosed" class="callout small">Chamado encerrado: a conversa fica disponível só para leitura.</p>
          <p v-else-if="!isRequester && !isAssignee" class="small muted">Só o solicitante e o responsável escrevem aqui. Você acompanha a conversa.</p>
        </section>
      </article>

      <aside aria-labelledby="historico" style="flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 12px">
        <h2 id="historico" class="group-label" style="font-size: 13px">Linha do tempo</h2>
        <ol class="timeline">
          <li v-for="(event, index) in timeline" :key="index">
            <span style="font-weight: 500">{{ event.label }}</span>
            <span class="muted">{{ formatShortTime(event.at) }}<template v-if="event.note"> · {{ event.note }}</template></span>
          </li>
        </ol>
        <RouterLink v-if="auth.canHandleTickets" :to="{ name: 'queue' }" class="section-link" style="margin-top: 8px">Voltar para a fila</RouterLink>
      </aside>
    </div>
  </div>

  <BaseModal
    :open="dialog === 'close'"
    :title="`Encerrar chamado ${ticket ? ticketCode(ticket) : ''}`"
    description="Conte o que foi feito. O solicitante vê a resolução e pode reabrir em até 7 dias."
    @close="closeDialog"
  >
    <div class="field">
      <label for="dl-resolucao" class="label">Resolução <span style="color: var(--danger-text)">(obrigatória)</span></label>
      <textarea id="dl-resolucao" v-model="resolution" class="textarea" rows="4" :maxlength="RESOLUTION_MAX_LENGTH" :aria-invalid="!!dialogError || undefined" />
      <span class="hint" style="text-align: right">{{ resolution.length }} de {{ RESOLUTION_MAX_LENGTH }}</span>
    </div>
    <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
    <template #footer>
      <button type="button" class="btn" :disabled="acting" @click="closeDialog">Cancelar</button>
      <button type="button" class="btn btn--primary" :disabled="acting" @click="submitClose">{{ acting ? 'Encerrando…' : 'Encerrar chamado' }}</button>
    </template>
  </BaseModal>

  <BaseModal
    :open="dialog === 'reassign'"
    title="Reatribuir chamado"
    description="Quem assume passa a ser o responsável. O solicitante e os dois responsáveis são avisados."
    @close="closeDialog"
  >
    <StateMessage v-if="assigneesLoading" state="loading" />
    <fieldset v-else class="assignees">
      <legend class="sr-only">Novo responsável</legend>
      <label
        v-for="person in assignees"
        :key="person.id"
        class="assignee"
        :class="{ 'is-chosen': chosenAssignee === person.id, 'is-disabled': person.id === ticket?.assigneeId }"
      >
        <input v-model="chosenAssignee" type="radio" name="responsavel" :value="person.id" :disabled="person.id === ticket?.assigneeId">
        <UserAvatar :name="person.fullName" />
        <span style="flex: 1; min-width: 0" class="truncate">{{ person.fullName }}</span>
        <span class="xsmall muted">{{ person.id === ticket?.assigneeId ? 'responsável atual' : `${person.inProgress} em andamento` }}</span>
      </label>
    </fieldset>
    <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
    <template #footer>
      <button type="button" class="btn" :disabled="acting" @click="closeDialog">Cancelar</button>
      <button type="button" class="btn btn--primary" :disabled="acting || assigneesLoading" @click="submitReassign">{{ acting ? 'Reatribuindo…' : 'Reatribuir' }}</button>
    </template>
  </BaseModal>

  <BaseModal
    :open="dialog === 'reopen'"
    :title="`Reabrir chamado ${ticket ? ticketCode(ticket) : ''}`"
    :description="`O chamado volta para ${ticket?.assigneeName ?? 'a fila'} se a pessoa ainda puder atender; senão, para a fila. Dá para reabrir até ${reopenUntil}, no máximo 3 vezes.`"
    @close="closeDialog"
  >
    <div class="field">
      <label for="dl-motivo" class="label">O que ainda não está resolvido?</label>
      <textarea id="dl-motivo" v-model="reopenReason" class="textarea" rows="4" :maxlength="REOPEN_MAX_LENGTH" aria-describedby="dl-motivo-ajuda" />
      <span id="dl-motivo-ajuda" class="hint">De {{ REOPEN_MIN_LENGTH }} a {{ REOPEN_MAX_LENGTH }} caracteres. O motivo entra na conversa do chamado.</span>
    </div>
    <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
    <template #footer>
      <button type="button" class="btn" :disabled="acting" @click="closeDialog">Cancelar</button>
      <button type="button" class="btn btn--primary" :disabled="acting" @click="submitReopen">{{ acting ? 'Reabrindo…' : 'Reabrir' }}</button>
    </template>
  </BaseModal>

  <BaseModal :open="dialog === 'edit'" title="Editar chamado" description="Dá para editar enquanto ninguém assumiu o chamado." :width="560" @close="closeDialog">
    <div class="field">
      <label for="ed-titulo" class="label">Título</label>
      <input id="ed-titulo" v-model="editForm.title" class="input" :maxlength="TITLE_MAX_LENGTH" :aria-invalid="!!editErrors.title || undefined">
      <span v-if="editErrors.title" class="field-error">{{ editErrors.title }}</span>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 12px">
      <div class="field" style="flex: 1 1 180px">
        <label for="ed-cat" class="label">Categoria</label>
        <select id="ed-cat" v-model="editForm.categoryId" class="select">
          <option v-if="ticket && !catalog.categories.some((c) => c.id === ticket!.category.id)" :value="ticket.category.id">{{ ticket.category.label }}</option>
          <option v-for="category in catalog.categories" :key="category.id" :value="category.id">{{ category.label }}</option>
        </select>
      </div>
      <div class="field" style="flex: 1 1 140px">
        <label for="ed-prio" class="label">Prioridade</label>
        <select id="ed-prio" v-model.number="editForm.priorityId" class="select">
          <option v-for="priority in catalog.priorities" :key="priority.id" :value="priority.id">{{ priority.label }}</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label for="ed-desc" class="label">Descrição</label>
      <textarea id="ed-desc" v-model="editForm.description" class="textarea" rows="6" :maxlength="DESCRIPTION_MAX_LENGTH" />
    </div>
    <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
    <template #footer>
      <button type="button" class="btn" :disabled="acting" @click="closeDialog">Cancelar</button>
      <button type="button" class="btn btn--primary" :disabled="acting" @click="submitEdit">{{ acting ? 'Salvando…' : 'Salvar' }}</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.mobile-back {
  display: none;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
}
@media (max-width: 900px) {
  .mobile-back {
    display: inline-flex;
  }
}
.comments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.comments li {
  display: flex;
  gap: 12px;
}
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.composer:focus-within {
  border-color: var(--accent);
}
.composer textarea {
  border: 0;
  resize: vertical;
  min-height: 64px;
  outline: none;
  line-height: 22px;
}
.assignees {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.assignee {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.assignee input {
  accent-color: var(--accent);
  margin: 0;
  width: 18px;
  height: 18px;
}
.assignee.is-chosen {
  border: 2px solid var(--accent);
  background: var(--accent-tint-2);
  padding: 0 11px;
}
.assignee.is-disabled {
  background: var(--surface-muted);
  color: var(--muted);
  cursor: not-allowed;
}
</style>
