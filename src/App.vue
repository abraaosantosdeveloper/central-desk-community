<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastStack from '@/components/ToastStack.vue'
import ServerStatusBanner from '@/components/ServerStatusBanner.vue'
</script>

<template>
  <ServerStatusBanner />
  <RouterView />
  <ToastStack />
</template>
