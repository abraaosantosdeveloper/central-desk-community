<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, categoriesApi, errorMessage, type Category } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import StateMessage from '@/components/StateMessage.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useToastsStore } from '@/stores/toasts'
import { formatNumber } from '@/utils/format'
import { CATEGORY_SWATCHES } from '@/utils/ticket'

// Categorias dos chamados. Remover arquiva: some do formulário, mas os chamados antigos continuam com ela.

const catalog = useCatalogStore()
const toasts = useToastsStore()

const usage = ref<Record<string, number>>({})
const loading = ref(true)
const error = ref('')

const newLabel = ref('')
const newColor = ref(CATEGORY_SWATCHES[0]!)
const creating = ref(false)
const createError = ref('')

const editing = ref<Category | null>(null)
const editLabel = ref('')
const editColor = ref('')
const editError = ref('')
const archiving = ref<Category | null>(null)
const busy = ref(false)

const rows = computed(() =>
  [...catalog.categories]
    .map((category) => ({ category, tickets: usage.value[category.id] ?? 0 }))
    .sort((a, b) => b.tickets - a.tickets || a.category.label.localeCompare(b.category.label, 'pt-BR')),
)
const maxUsage = computed(() => Math.max(1, ...rows.value.map((row) => row.tickets)))

async function load() {
  error.value = ''
  try {
    const [, usageList] = await Promise.all([catalog.reloadCategories(), categoriesApi.usage()])
    usage.value = Object.fromEntries(usageList.map((item) => [item.categoryId, item.tickets]))
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function fieldError(err: unknown) {
  if (err instanceof ApiError) return err.fieldErrors.label ?? err.fieldErrors.color ?? err.message
  return errorMessage(err)
}

async function create() {
  if (creating.value) return
  createError.value = ''
  if (!newLabel.value.trim()) {
    createError.value = 'Dê um nome à categoria.'
    return
  }
  creating.value = true
  try {
    await categoriesApi.create({ label: newLabel.value.trim(), color: newColor.value })
    toasts.success(`Categoria “${newLabel.value.trim()}” criada.`)
    newLabel.value = ''
    await load()
  } catch (err) {
    createError.value = fieldError(err)
  } finally {
    creating.value = false
  }
}

function startEdit(category: Category) {
  editing.value = category
  editLabel.value = category.label
  editColor.value = category.color
  editError.value = ''
}

async function saveEdit() {
  if (!editing.value || busy.value) return
  if (!editLabel.value.trim()) {
    editError.value = 'Dê um nome à categoria.'
    return
  }
  busy.value = true
  try {
    await categoriesApi.update(editing.value.id, { label: editLabel.value.trim(), color: editColor.value })
    toasts.success('Categoria atualizada.')
    editing.value = null
    await load()
  } catch (err) {
    editError.value = fieldError(err)
  } finally {
    busy.value = false
  }
}

async function archive() {
  if (!archiving.value || busy.value) return
  busy.value = true
  try {
    await categoriesApi.remove(archiving.value.id)
    toasts.success(`Categoria “${archiving.value.label}” arquivada.`)
    archiving.value = null
    await load()
  } catch (err) {
    toasts.error(errorMessage(err))
  } finally {
    busy.value = false
  }
}

function isHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Administração' }, { label: 'Categorias' }]" />

  <div class="page page--narrow" style="gap: 24px">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Categorias</h1>
        <p class="page-subtitle">Organizam os chamados no formulário e nos filtros. Arquivar tira a categoria do formulário, mas os chamados antigos continuam com ela.</p>
      </div>
    </div>

    <form class="card card--muted new-category" novalidate @submit.prevent="create">
      <div class="field" style="flex: 1 1 220px">
        <label for="cat-nome" class="label">Nova categoria</label>
        <input id="cat-nome" v-model="newLabel" class="input" type="text" maxlength="60" placeholder="Ex.: Telefonia" :aria-invalid="!!createError || undefined">
      </div>
      <fieldset class="swatches">
        <legend class="label" style="padding: 0; margin-bottom: 6px">Cor</legend>
        <div style="display: flex; flex-wrap: wrap; gap: 6px">
          <button
            v-for="color in CATEGORY_SWATCHES"
            :key="color"
            type="button"
            class="swatch"
            :aria-label="`Cor ${color}`"
            :aria-pressed="newColor === color"
            @click="newColor = color"
          ><span :style="{ background: color }" /></button>
        </div>
      </fieldset>
      <button type="submit" class="btn btn--primary" :disabled="creating">{{ creating ? 'Adicionando…' : 'Adicionar' }}</button>
      <p v-if="createError" class="field-error" role="alert" style="flex-basis: 100%">{{ createError }}</p>
    </form>

    <StateMessage v-if="error" state="error" :message="error" @retry="load" />
    <StateMessage v-else-if="loading" state="loading" />
    <StateMessage v-else-if="!rows.length" state="empty" message="Nenhuma categoria ativa. Crie a primeira acima." />

    <div v-else class="table-scroll">
      <table class="table" style="min-width: 520px; font-size: 14px">
        <thead>
          <tr>
            <th scope="col">Categoria</th>
            <th scope="col" style="width: 42%">Chamados</th>
            <th scope="col" style="width: 104px"><span class="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.category.id">
            <td style="padding: 8px">
              <span style="display: inline-flex; align-items: center; gap: 10px; font-weight: 500">
                <span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 3px" :style="{ background: row.category.color }" />{{ row.category.label }}
              </span>
            </td>
            <td style="padding: 8px">
              <span style="display: flex; align-items: center; gap: 10px; font-size: 13px">
                <span aria-hidden="true" class="usage"><span :style="{ width: `${(row.tickets / maxUsage) * 100}%` }" /></span>
                <span style="width: 40px; text-align: right">{{ formatNumber(row.tickets) }}</span>
              </span>
            </td>
            <td style="padding: 8px">
              <span style="display: flex; gap: 2px; justify-content: flex-end">
                <button type="button" class="btn btn--icon" :aria-label="`Editar ${row.category.label}`" @click="startEdit(row.category)"><AppIcon name="edit" :size="16" :stroke-width="1.8" /></button>
                <button type="button" class="btn btn--icon" :aria-label="`Arquivar ${row.category.label}`" @click="archiving = row.category"><AppIcon name="archive" :size="16" :stroke-width="1.8" /></button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <BaseModal :open="!!editing" title="Editar categoria" @close="editing = null">
    <div class="field">
      <label for="cat-edit-nome" class="label">Nome</label>
      <input id="cat-edit-nome" v-model="editLabel" class="input" maxlength="60">
    </div>
    <fieldset class="swatches">
      <legend class="label" style="padding: 0; margin-bottom: 6px">Cor</legend>
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px">
        <button v-for="color in CATEGORY_SWATCHES" :key="color" type="button" class="swatch" :aria-label="`Cor ${color}`" :aria-pressed="editColor.toLowerCase() === color.toLowerCase()" @click="editColor = color"><span :style="{ background: color }" /></button>
        <label class="sr-only" for="cat-edit-hex">Outra cor (hexadecimal)</label>
        <input id="cat-edit-hex" v-model="editColor" class="input" style="width: 110px; min-height: 36px" maxlength="7" :aria-invalid="!isHex(editColor) || undefined">
      </div>
    </fieldset>
    <p v-if="editError" class="field-error" role="alert">{{ editError }}</p>
    <template #footer>
      <button type="button" class="btn" :disabled="busy" @click="editing = null">Cancelar</button>
      <button type="button" class="btn btn--primary" :disabled="busy || !isHex(editColor)" @click="saveEdit">{{ busy ? 'Salvando…' : 'Salvar' }}</button>
    </template>
  </BaseModal>

  <ConfirmDialog
    :open="!!archiving"
    :title="`Arquivar “${archiving?.label ?? ''}”?`"
    description="A categoria sai do formulário de chamados. Os chamados que já a usam continuam com ela."
    confirm-label="Arquivar"
    :busy="busy"
    @confirm="archive"
    @cancel="archiving = null"
  />
</template>

<style scoped>
.new-category {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 16px;
}
.swatches {
  border: 0;
  margin: 0;
  padding: 0;
}
.swatch {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.swatch[aria-pressed='true'] {
  border: 2px solid var(--text);
}
.swatch span {
  width: 20px;
  height: 20px;
  border-radius: 5px;
}
.usage {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--surface-sunken);
  overflow: hidden;
}
.usage span {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: #77766f;
}
</style>
