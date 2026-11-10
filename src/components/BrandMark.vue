<script setup lang="ts">
// Logo do CentralDesk: fone de atendimento com um balão em forma de ticket.
// Desenhado em SVG no próprio componente (o mesmo de public/favicon.svg e src/assets/logo.svg).
withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <svg
    class="mark"
    aria-hidden="true"
    :width="size"
    :height="size"
    viewBox="6 9.5 52 52"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13.5 34 A18.5 18.5 0 0 1 50.5 34" fill="none" stroke="#13294B" stroke-width="4.5" stroke-linecap="round" />
    <rect x="8.5" y="30" width="9.5" height="17" rx="4.5" fill="#13294B" />
    <rect x="46" y="30" width="9.5" height="17" rx="4.5" fill="#13294B" />
    <path d="M50.75 46 C50.75 52 46.5 55 40.5 55" fill="none" stroke="#13294B" stroke-width="3" stroke-linecap="round" />
    <rect x="29" y="52" width="12" height="6" rx="3" fill="#13294B" />
    <path
      d="M24 22.5 H40 A3 3 0 0 1 43 25.5 V29 A2.6 2.6 0 0 0 43 34.2 V37.5 A3 3 0 0 1 40 40.5 H29.5 L24 45.5 V40.5 A3 3 0 0 1 21 37.5 V25.5 A3 3 0 0 1 24 22.5 Z"
      fill="#1F6BEF"
    />
    <path d="M26 29 H36.5 M26 34 H33" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.mark {
  flex: none;
  display: block;
}
</style>
