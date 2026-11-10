<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

// Janela modal com <dialog> nativo: foco preso, Esc e fundo escurecido de graça.
// Quem usa controla `open` e responde ao evento `close`.

const props = withDefaults(
  defineProps<{ open: boolean; title: string; description?: string; tone?: 'default' | 'danger'; width?: number }>(),
  { description: '', tone: 'default', width: 460 },
)
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const descriptionId = useId()

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const element = dialog.value
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  },
  { immediate: true },
)

function onCancel(event: Event) {
  event.preventDefault()
  emit('close')
}

function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}

onBeforeUnmount(() => dialog.value?.open && dialog.value.close())
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :style="{ '--modal-width': `${width}px` }"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    @cancel="onCancel"
    @click="onBackdrop"
  >
    <div v-if="open" class="modal__body">
      <div class="modal__head">
        <span v-if="tone === 'danger'" class="modal__danger-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0" /><path d="m5.6 5.6 12.8 12.8" /></svg>
        </span>
        <div class="modal__text">
          <h2 :id="titleId" class="modal__title">{{ title }}</h2>
          <p v-if="description" :id="descriptionId" class="modal__description">{{ description }}</p>
        </div>
      </div>
      <slot />
      <div v-if="$slots.footer" class="modal__footer">
        <slot name="footer" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(var(--modal-width), calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--bg);
  color: var(--text);
  box-shadow: var(--shadow-pop);
}
.modal::backdrop {
  background: rgba(15, 15, 15, 0.38);
}
.modal__body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.modal__head {
  display: flex;
  gap: 12px;
}
.modal__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.modal__danger-icon {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: var(--danger-tint);
  color: var(--danger-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal__title {
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
}
.modal__description {
  color: var(--text-2);
}
.modal__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
</style>
