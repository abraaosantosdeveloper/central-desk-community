<script setup lang="ts">
// Carregando, erro ou vazio: o mesmo bloco em todas as listas.
withDefaults(defineProps<{ state: 'loading' | 'error' | 'empty'; message?: string }>(), { message: '' })
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="state" :role="state === 'error' ? 'alert' : 'status'">
    <template v-if="state === 'loading'">
      <span class="state__spinner" aria-hidden="true" />
      <span>{{ message || 'Carregando…' }}</span>
    </template>
    <template v-else-if="state === 'error'">
      <span>{{ message || 'Não foi possível carregar.' }}</span>
      <button type="button" class="btn btn--sm" @click="emit('retry')">Tentar de novo</button>
    </template>
    <template v-else>
      <span>{{ message || 'Nada por aqui.' }}</span>
      <slot />
    </template>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  color: var(--muted);
  text-align: center;
}
.state__spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
