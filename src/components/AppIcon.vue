<script setup lang="ts">
import { computed } from 'vue'

// Ícones de traço (24×24), desenhados para o design. Sempre decorativos: quem precisa de nome
// é o botão ou o link em volta (aria-label), não o ícone.

const ICONS = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20h14V9.5'],
  bell: ['M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8', 'M10 20a2 2 0 0 0 4 0'],
  plus: ['M12 5v14', 'M5 12h14'],
  doc: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z'],
  board: [
    'M4.5 4h2a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 6.5 20h-2A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4z',
    'M11.5 4h2A1.5 1.5 0 0 1 15 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 10 13.5v-8A1.5 1.5 0 0 1 11.5 4z',
    'M18.5 4h1A1.5 1.5 0 0 1 21 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 17 9.5v-4A1.5 1.5 0 0 1 18.5 4z',
  ],
  table: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18', 'M9 10v10'],
  layers: ['M12 3 2 8l10 5 10-5z', 'M2 13l10 5 10-5'],
  pulse: ['M3 12h4l3-8 4 16 3-8h4'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  users: [
    'M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
    'M2.5 20a6.5 6.5 0 0 1 13 0',
    'M16 4.5a3.5 3.5 0 0 1 0 7',
    'M18 14a6 6 0 0 1 3.5 6',
  ],
  approve: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'm8.5 12 2.5 2.5 4.5-5'],
  tag: ['M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z', 'M6 7.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0'],
  logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 17l-5-5 5-5', 'M5 12h11'],
  search: ['M4 11a7 7 0 1 0 14 0 7 7 0 1 0-14 0', 'm20 20-3.5-3.5'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  chevronLeft: ['m15 6-6 6 6 6'],
  chevronsUpDown: ['m7 15 5 5 5-5', 'm7 9 5-5 5 5'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1', 'M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.4-1.6', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  mail: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'm3 7 9 6 9-6'],
  lock: ['M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  info: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'M12 11v5', 'M12 7.5v.01'],
  alert: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'M12 8v5', 'M12 16.5v.01'],
  warning: ['M12 3 2 20h20z', 'M12 10v4', 'M12 17v.01'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  checkDouble: ['m2 12.5 4.5 4.5L15 8.5', 'm10 16 1 1 8.5-8.5'],
  circle: ['M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0'],
  reassign: ['M17 3l4 4-4 4', 'M3 11V9a2 2 0 0 1 2-2h16', 'M7 21l-4-4 4-4', 'M21 13v2a2 2 0 0 1-2 2H3'],
  reopen: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  building: ['M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M16 9h2a2 2 0 0 1 2 2v10', 'M2 21h20'],
  user: ['M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0', 'M4 21a8 8 0 0 1 16 0'],
  userCheck: ['M5 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0', 'M2 21a7 7 0 0 1 14 0', 'm16 11 2 2 4-4'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  clock: ['M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0', 'M12 8v4l2.5 2'],
  priority: ['M5 20v-4', 'M10 20v-8', 'M15 20V8', 'M20 20V4'],
  message: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  edit: ['M4 20h4L19 9l-4-4L4 16z'],
  archive: ['M4 4h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9', 'M10 13h4'],
  monitor: ['M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 20h8', 'M12 16v4'],
  phone: ['M8.5 2h7A2.5 2.5 0 0 1 18 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19.5v-15A2.5 2.5 0 0 1 8.5 2z', 'M11 18h2'],
  shield: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z'],
  key: ['M4 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0', 'm11 12 9-9', 'm17 6 3 3'],
  sort: ['M7 4v16', 'm3 8 4-4 4 4', 'M17 20V4', 'm21 16-4 4-4-4'],
  send: ['M5 12h14', 'm13 6 6 6-6 6'],
  copy: ['M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'],
  ban: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'm5.6 5.6 12.8 12.8'],
  refresh: ['M20 12a8 8 0 0 1-14.3 4.9', 'M4 12a8 8 0 0 1 14.3-4.9', 'M18 3v4h-4', 'M6 21v-4h4'],
  arrowRight: ['M5 12h14', 'm13 6 6 6-6 6'],
} as const

export type IconName = keyof typeof ICONS

const props = withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 18,
  strokeWidth: 1.7,
})

const paths = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    aria-hidden="true"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>
