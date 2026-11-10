<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{ page: number; totalPages: number; summary: string }>()
const emit = defineEmits<{ change: [page: number] }>()
</script>

<template>
  <div class="pagination">
    <span class="pagination__info">{{ summary }}</span>
    <template v-if="totalPages > 1">
      <button type="button" class="btn btn--sm btn--ghost" :disabled="page <= 0" aria-label="Página anterior" @click="emit('change', page - 1)">
        <AppIcon name="chevronLeft" :size="16" />
      </button>
      <span>Página {{ page + 1 }} de {{ totalPages }}</span>
      <button type="button" class="btn btn--sm btn--ghost" :disabled="page >= totalPages - 1" aria-label="Próxima página" @click="emit('change', page + 1)">
        <AppIcon name="chevronRight" :size="16" />
      </button>
    </template>
  </div>
</template>
