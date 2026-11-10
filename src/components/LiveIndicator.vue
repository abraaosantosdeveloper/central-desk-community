<script setup lang="ts">
import { computed } from 'vue'
import { useRealtimeStore } from '@/stores/realtime'

// Estado da conexão em tempo real, sempre visível (heurística: visibilidade do status do sistema).
defineProps<{ extra?: string }>()
const realtime = useRealtimeStore()

const view = computed(() => {
  if (realtime.state === 'live') return { label: 'Ao vivo', dot: '' }
  if (realtime.state === 'offline') return { label: 'Desconectado', dot: 'live-dot--off' }
  return { label: 'Reconectando…', dot: 'live-dot--wait' }
})
</script>

<template>
  <span class="live" role="status">
    <span class="live-dot" :class="view.dot" aria-hidden="true" />{{ view.label }}<template v-if="extra && realtime.state === 'live'"> · {{ extra }}</template>
  </span>
</template>

<style scoped>
.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
</style>
