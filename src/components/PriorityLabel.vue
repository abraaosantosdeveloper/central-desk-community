<script setup lang="ts">
import { computed } from 'vue'
import type { Priority } from '@/api'

// Prioridade como "barrinhas de sinal": a forma diferencia do status (que é cor), e Crítica fica em vermelho.
const props = withDefaults(defineProps<{ priority: Priority; compact?: boolean }>(), { compact: false })

const level = computed(() => Math.min(4, Math.max(1, props.priority.id)))
const critical = computed(() => level.value >= 4)
const heights = computed(() => (props.compact ? [4, 7, 10, 10] : [5, 8, 12, 12]))
</script>

<template>
  <span class="priority" :class="{ 'is-critical': critical }">
    <span class="priority__bars" aria-hidden="true" :style="{ height: `${heights[3]}px` }">
      <span
        v-for="(height, index) in heights"
        :key="index"
        :class="{ 'is-on': index < level }"
        :style="{ height: `${height}px` }"
      />
    </span>
    {{ priority.label }}
  </span>
</template>

<style scoped>
.priority {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
.priority.is-critical {
  color: var(--danger-text);
  font-weight: 500;
}
.priority__bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
}
.priority__bars span {
  width: 3px;
  border-radius: 1px;
  background: var(--bar-empty);
}
.priority__bars span.is-on {
  background: var(--text);
}
.is-critical .priority__bars span.is-on {
  background: var(--danger);
}
</style>
