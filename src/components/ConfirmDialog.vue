<script setup lang="ts">
import BaseModal from './BaseModal.vue'

// Confirmação antes de uma ação que encerra, apaga ou não se desfaz (prevenção de erro).
// O foco começa em "Cancelar", a opção segura.

withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel: string
    cancelLabel?: string
    tone?: 'default' | 'danger'
    busy?: boolean
  }>(),
  { description: '', cancelLabel: 'Cancelar', tone: 'default', busy: false },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="title" :description="description" :tone="tone" @close="emit('cancel')">
    <slot />
    <template #footer>
      <button type="button" class="btn" autofocus :disabled="busy" @click="emit('cancel')">{{ cancelLabel }}</button>
      <button
        type="button"
        class="btn"
        :class="tone === 'danger' ? 'btn--danger' : 'btn--primary'"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ busy ? 'Aguarde…' : confirmLabel }}
      </button>
    </template>
  </BaseModal>
</template>
