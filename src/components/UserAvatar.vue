<script setup lang="ts">
import { computed } from 'vue'
import { avatarTone, initials } from '@/utils/user'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 28 })
const tone = computed(() => avatarTone(props.name))
const fontSize = computed(() => Math.max(10, Math.round(props.size * 0.39)))
</script>

<template>
  <span
    class="avatar"
    aria-hidden="true"
    :style="{ width: `${size}px`, height: `${size}px`, background: tone.bg, color: tone.fg, fontSize: `${fontSize}px` }"
  >{{ initials(name) }}</span>
</template>
