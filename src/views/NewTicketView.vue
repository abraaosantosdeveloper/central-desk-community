<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ApiError, errorMessage, ticketsApi } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import StateMessage from '@/components/StateMessage.vue'
import { SUPPORT_TEAM_NAME } from '@/config'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useToastsStore } from '@/stores/toasts'
import { DESCRIPTION_MAX_LENGTH, PRIORITY_HINTS, TITLE_MAX_LENGTH, ticketCode } from '@/utils/ticket'

// Novo chamado no formato de "página": título grande, propriedades e descrição.
// O rascunho fica neste navegador (localStorage), para não se perder num recarregamento.

const DRAFT_KEY = 'centraldesk:rascunho-chamado'

const auth = useAuthStore()
const catalog = useCatalogStore()
const toasts = useToastsStore()
const router = useRouter()

const form = reactive({ title: '', description: '', categoryId: '', priorityId: 2 })
const fieldErrors = ref<Record<string, string>>({})
const generalError = ref('')
const loadError = ref('')
const busy = ref(false)
const draftSaved = ref(false)

// Setor de origem: por padrão, o departamento de quem abre. Só administradores podem trocar
// (para abrir em nome de outro setor); os demais veem o campo travado. Fica fora do rascunho.
const ownDepartmentId = computed(() => auth.currentUser?.departmentId ?? '')
const originDepartmentId = ref(ownDepartmentId.value)
const originChanged = computed(() => auth.isAdmin && !!originDepartmentId.value && originDepartmentId.value !== ownDepartmentId.value)
const departments = computed(() => [...catalog.departments].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const draft = JSON.parse(raw) as Partial<typeof form>
    Object.assign(form, draft)
  } catch {
    // Sem armazenamento: o formulário começa vazio
  }
}

function writeDraft() {
  try {
    if (!form.title && !form.description) localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    draftSaved.value = !!(form.title || form.description)
  } catch {
    draftSaved.value = false
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // nada a fazer
  }
}

readDraft()
watch(form, writeDraft, { deep: true })

onMounted(async () => {
  if (auth.isAdmin) {
    catalog.loadDepartments().catch((error) => {
      loadError.value = errorMessage(error)
    })
  }
  try {
    await catalog.loadTicketOptions()
    if (!form.categoryId || !catalog.categories.some((c) => c.id === form.categoryId)) {
      form.categoryId = catalog.categories[0]?.id ?? ''
    }
  } catch (error) {
    loadError.value = errorMessage(error)
  }
})

const priorities = computed(() => [...catalog.priorities].sort((a, b) => a.id - b.id))

function validate() {
  const errors: Record<string, string> = {}
  if (!form.title.trim()) errors.title = 'Dê um título curto ao chamado.'
  if (!form.description.trim()) errors.description = 'Conte o que aconteceu.'
  if (!form.categoryId) errors.categoryId = 'Escolha uma categoria.'
  if (auth.isAdmin && !originDepartmentId.value) errors.originDepartmentId = 'Escolha o setor de origem.'
  fieldErrors.value = errors
  return !Object.keys(errors).length
}

async function submit() {
  if (busy.value) return
  generalError.value = ''
  if (!validate()) return
  busy.value = true
  try {
    const created = await ticketsApi.create({
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      priorityId: form.priorityId,
      ...(originChanged.value ? { originDepartmentId: originDepartmentId.value } : {}),
    })
    clearDraft()
    toasts.success(`Chamado ${ticketCode(created)} aberto. Você recebe um aviso quando alguém assumir.`)
    await router.replace({ name: 'ticket', params: { id: created.id } })
  } catch (error) {
    if (error instanceof ApiError) fieldErrors.value = error.fieldErrors
    generalError.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Chamados', to: { name: 'mine' } }, { label: 'Novo chamado' }]">
    <span v-if="draftSaved" class="small muted" style="padding: 0 8px">Rascunho salvo neste navegador</span>
  </PageTopbar>

  <div class="page page--medium" style="padding-top: 40px">
    <StateMessage v-if="loadError" state="error" :message="loadError" @retry="() => catalog.loadTicketOptions()" />

    <div class="row-wrap" style="gap: 48px">
      <form class="form" style="flex: 3 1 520px; min-width: 0; gap: 24px" novalidate @submit.prevent="submit">
        <div class="field">
          <label for="nc-titulo" class="label" style="color: var(--muted)">Título</label>
          <input
            id="nc-titulo"
            v-model="form.title"
            type="text"
            class="title-input"
            placeholder="Ex.: Impressora do 2º andar sem toner"
            :maxlength="TITLE_MAX_LENGTH"
            :aria-invalid="!!fieldErrors.title || undefined"
          >
          <span class="hint" style="display: flex; gap: 8px">
            <span v-if="fieldErrors.title" class="field-error" style="flex: 1">{{ fieldErrors.title }}</span>
            <span style="margin-left: auto">{{ form.title.length }} de {{ TITLE_MAX_LENGTH }}</span>
          </span>
        </div>

        <div class="props-form">
          <template v-if="auth.isAdmin">
            <label for="nc-origem" class="props-form__label"><AppIcon name="arrowRight" :size="16" />Setor de origem</label>
            <span class="field">
              <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
                <select
                  id="nc-origem"
                  v-model="originDepartmentId"
                  class="select"
                  style="max-width: 280px"
                  aria-describedby="nc-origem-ajuda"
                  :aria-invalid="!!fieldErrors.originDepartmentId || undefined"
                >
                  <option v-for="department in departments" :key="department.id" :value="department.id">
                    {{ department.name }}{{ department.id === ownDepartmentId ? ' (o seu)' : '' }}
                  </option>
                </select>
                <span v-if="originChanged" class="tag tag--open">Alterado</span>
              </span>
              <span v-if="fieldErrors.originDepartmentId" class="field-error">{{ fieldErrors.originDepartmentId }}</span>
              <span id="nc-origem-ajuda" class="hint">Só administradores escolhem. Use quando abrir o chamado em nome de outro setor; por padrão, é o seu.</span>
            </span>
          </template>
          <template v-else>
            <span id="nc-origem-rotulo" class="props-form__label"><AppIcon name="arrowRight" :size="16" />Setor de origem</span>
            <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
              <span class="fixed-value" aria-labelledby="nc-origem-rotulo" style="gap: 8px">
                <AppIcon name="lock" :size="14" :stroke-width="1.9" style="color: var(--faint)" />{{ auth.currentUser?.departmentName }}
              </span>
              <span class="hint">É o seu departamento. Só administradores podem mudar.</span>
            </span>
          </template>

          <span class="props-form__label"><AppIcon name="building" :size="16" />Setor de destino</span>
          <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <span class="fixed-value">{{ SUPPORT_TEAM_NAME }}</span>
            <span class="hint">Por enquanto, só {{ SUPPORT_TEAM_NAME }} recebe chamados.</span>
          </span>

          <label for="nc-cat" class="props-form__label"><AppIcon name="tag" :size="16" />Categoria</label>
          <span class="field">
            <select id="nc-cat" v-model="form.categoryId" class="select" style="max-width: 280px" :aria-invalid="!!fieldErrors.categoryId || undefined">
              <option v-for="category in catalog.categories" :key="category.id" :value="category.id">{{ category.label }}</option>
            </select>
            <span v-if="fieldErrors.categoryId" class="field-error">{{ fieldErrors.categoryId }}</span>
          </span>

          <span id="nc-prio-rotulo" class="props-form__label"><AppIcon name="priority" :size="16" />Prioridade</span>
          <div role="radiogroup" aria-labelledby="nc-prio-rotulo" class="prio-options">
            <label v-for="priority in priorities" :key="priority.id" class="prio-option" :class="{ 'is-checked': form.priorityId === priority.id }">
              <input v-model="form.priorityId" type="radio" name="prioridade" :value="priority.id">{{ priority.label }}
            </label>
          </div>
        </div>

        <hr class="divider">

        <div class="field">
          <label for="nc-desc" class="section-title">Descrição</label>
          <textarea
            id="nc-desc"
            v-model="form.description"
            class="textarea"
            rows="8"
            :maxlength="DESCRIPTION_MAX_LENGTH"
            :aria-invalid="!!fieldErrors.description || undefined"
            aria-describedby="nc-desc-ajuda"
          />
          <span v-if="fieldErrors.description" class="field-error">{{ fieldErrors.description }}</span>
          <span id="nc-desc-ajuda" class="hint">Conte o que aconteceu, desde quando e o que você já tentou.</span>
        </div>

        <p v-if="generalError" role="alert" class="callout"><AppIcon name="alert" style="color: var(--danger-text)" /><span>{{ generalError }}</span></p>

        <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px">
          <RouterLink :to="{ name: 'home' }" class="btn btn--ghost">Cancelar</RouterLink>
          <button type="submit" class="btn btn--primary" :disabled="busy">{{ busy ? 'Abrindo…' : 'Abrir chamado' }}</button>
        </div>
      </form>

      <aside aria-labelledby="nc-dicas" class="card card--muted" style="flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 14px; padding: 18px">
        <h2 id="nc-dicas" style="font-size: 14px; font-weight: 600">Como a prioridade é usada</h2>
        <dl style="display: flex; flex-direction: column; gap: 10px; font-size: 13px">
          <div v-for="priority in [...priorities].reverse()" :key="priority.id">
            <dt style="font-weight: 600">{{ priority.label }}</dt>
            <dd style="color: var(--text-2)">{{ PRIORITY_HINTS[priority.id] ?? '' }}</dd>
          </div>
        </dl>
        <p style="font-size: 13px; color: var(--text-2)">Você recebe um aviso quando alguém assumir o chamado, e pode editá-lo enquanto ele estiver na fila.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.title-input {
  border: 0;
  border-bottom: 1px solid var(--border);
  padding: 4px 0 10px;
  font-size: 32px;
  line-height: 40px;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: transparent;
  width: 100%;
}
.title-input::placeholder {
  color: var(--disabled);
}
.title-input:focus {
  outline: none;
  border-bottom-color: var(--accent);
}
.props-form {
  display: grid;
  grid-template-columns: minmax(120px, 170px) minmax(0, 1fr);
  row-gap: 12px;
  column-gap: 12px;
  align-items: center;
}
.props-form__label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}
.fixed-value {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-muted);
}
.prio-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.prio-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  cursor: pointer;
}
.prio-option input {
  accent-color: var(--accent);
  margin: 0;
}
.prio-option.is-checked {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--open-text);
  font-weight: 500;
}
@media (max-width: 640px) {
  .props-form {
    grid-template-columns: 1fr;
    row-gap: 6px;
  }
  .props-form > :nth-child(2n) {
    margin-bottom: 8px;
  }
}
</style>
