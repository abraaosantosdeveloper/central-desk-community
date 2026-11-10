<script setup lang="ts">
import BrandMark from './BrandMark.vue'

// Esqueleto das telas sem login: marca no topo, coluna estreita no meio.
withDefaults(defineProps<{ width?: number; footer?: boolean }>(), { width: 400, footer: false })
</script>

<template>
  <div class="auth">
    <header class="auth__header">
      <BrandMark :size="32" />
      <span class="auth__brand">CentralDesk</span>
    </header>
    <main class="auth__main" :style="{ maxWidth: `${width}px` }">
      <slot />
    </main>
    <footer v-if="footer" class="auth__footer">
      Sessão protegida por cookie seguro
    </footer>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px;
}
.auth__header {
  width: 100%;
  max-width: 1200px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 64px;
}
.auth__brand {
  font-weight: 600;
  font-size: 15px;
}
.auth__main {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 40px 0 88px;
}
.auth__footer {
  width: 100%;
  max-width: 1200px;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
:slotted(.auth-title) {
  font-size: 30px;
  line-height: 38px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
:slotted(.auth-head) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:slotted(.auth-icon) {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
}
</style>
