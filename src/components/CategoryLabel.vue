<script setup lang="ts">
import type { Category } from '@/api'

defineProps<{ category: Category }>()
</script>

<template>
  <span class="category">
    <span class="dot" aria-hidden="true" :style="{ background: category.color }" />
    <span class="truncate" :title="category.label">{{ category.label }}</span>
  </span>
</template>

<style scoped>
.category {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: var(--text-2);
}
</style>
