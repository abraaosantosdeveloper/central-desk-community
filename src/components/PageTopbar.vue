<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

// Faixa do topo de cada tela: caminho (breadcrumb) à esquerda, ações à direita.
export interface Crumb {
  label: string
  to?: RouteLocationRaw
}
defineProps<{ crumbs: Crumb[] }>()
</script>

<template>
  <header class="topbar">
    <nav aria-label="Caminho" class="topbar__crumbs">
      <template v-for="(crumb, index) in crumbs" :key="index">
        <span v-if="index > 0" aria-hidden="true" class="topbar__sep">/</span>
        <RouterLink v-if="crumb.to" :to="crumb.to" class="topbar__link">{{ crumb.label }}</RouterLink>
        <span v-else :aria-current="index === crumbs.length - 1 ? 'page' : undefined" :class="{ 'topbar__current': index === crumbs.length - 1 }">{{ crumb.label }}</span>
      </template>
    </nav>
    <div class="topbar__actions">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 4px 16px;
}
.topbar__crumbs {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--text-2);
}
.topbar__sep {
  color: var(--disabled);
}
.topbar__link {
  color: var(--text-2);
  text-decoration: none;
}
.topbar__link:hover {
  color: var(--text);
  text-decoration: underline;
}
.topbar__current {
  color: var(--text);
}
.topbar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
@media (max-width: 900px) {
  .topbar {
    min-height: 0;
    padding: 12px 16px 0;
  }
  .topbar__crumbs {
    display: none;
  }
}
</style>
