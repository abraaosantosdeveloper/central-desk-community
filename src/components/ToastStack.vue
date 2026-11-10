<script setup lang="ts">
import { useToastsStore } from '@/stores/toasts'
import AppIcon from './AppIcon.vue'

const toasts = useToastsStore()
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="toast in toasts.toasts" :key="toast.id" class="toast" :class="`toast--${toast.kind}`" role="status">
      <AppIcon :name="toast.kind === 'error' ? 'alert' : toast.kind === 'success' ? 'check' : 'info'" :size="16" />
      <span class="toast__text">{{ toast.message }}</span>
      <button type="button" class="toast__close" aria-label="Fechar aviso" @click="toasts.dismiss(toast.id)">
        <AppIcon name="close" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(380px, calc(100vw - 32px));
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 8px 12px 14px;
  border-radius: var(--radius-md);
  background: var(--text);
  color: #fff;
  box-shadow: var(--shadow-pop);
}
.toast > svg {
  flex: none;
  margin-top: 2px;
}
.toast--error > svg {
  color: #ffb4ab;
}
.toast--success > svg {
  color: #9be3b4;
}
.toast__text {
  flex: 1;
}
.toast__close {
  flex: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
</style>
