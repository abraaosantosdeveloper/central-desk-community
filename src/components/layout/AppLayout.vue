<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useLogout } from '@/composables/useLogout'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCountersStore } from '@/stores/counters'
import { useRealtimeStore } from '@/stores/realtime'
import AppIcon from '../AppIcon.vue'
import BrandMark from '../BrandMark.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import SideNav from './SideNav.vue'

// Esqueleto da área logada. Acima de 900 px: barra lateral fixa. Até 900 px: cabeçalho com
// botão hambúrguer e gaveta lateral (nunca menu horizontal).

const auth = useAuthStore()
const realtime = useRealtimeStore()
const counters = useCountersStore()
const activity = useActivityStore()
const router = useRouter()
const route = useRoute()
const logout = useLogout()

const drawerOpen = ref(false)
const drawerCloseButton = ref<HTMLButtonElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)

let stopSessionEnded: (() => void) | null = null

onMounted(() => {
  realtime.connect()
  counters.start()
  activity.start()
  stopSessionEnded = realtime.on('session.ended', () => void auth.recheckSession())
})

onUnmounted(() => {
  stopSessionEnded?.()
  realtime.disconnect()
  counters.reset()
  activity.reset()
})

// A sessão acabou (logout, expirou, conta desativada): volta para o login
watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (!authenticated) void router.replace({ name: 'login' })
  },
)

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)

async function openDrawer() {
  drawerOpen.value = true
  await nextTick()
  drawerCloseButton.value?.focus()
}

function closeDrawer() {
  drawerOpen.value = false
  void nextTick(() => menuButton.value?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drawerOpen.value) closeDrawer()
}

function goToSearch() {
  drawerOpen.value = false
  void router.push({ name: auth.canBrowseAllTickets ? 'all-tickets' : 'mine', query: { busca: '1' } })
}
</script>

<template>
  <div class="shell" @keydown="onKeydown">
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

    <aside class="shell__sidebar">
      <SideNav @logout="logout.ask" @search="goToSearch" />
    </aside>

    <header class="shell__mobile-header">
      <button
        ref="menuButton"
        type="button"
        class="btn btn--icon"
        aria-label="Abrir menu"
        aria-controls="gaveta"
        :aria-expanded="drawerOpen"
        @click="openDrawer"
      >
        <AppIcon name="menu" :size="22" :stroke-width="1.8" />
      </button>
      <span class="shell__mobile-brand"><BrandMark :size="28" />CentralDesk</span>
      <RouterLink :to="{ name: 'activity' }" class="btn btn--icon shell__bell" :aria-label="`Notificações, ${activity.unread} não lidas`">
        <AppIcon name="bell" :size="20" />
        <span v-if="activity.unread" class="shell__bell-dot" aria-hidden="true" />
      </RouterLink>
    </header>

    <div v-if="drawerOpen" class="shell__backdrop" aria-hidden="true" @click="closeDrawer" />
    <div
      v-show="drawerOpen"
      id="gaveta"
      class="shell__drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <div class="shell__drawer-top">
        <button ref="drawerCloseButton" type="button" class="btn btn--icon" aria-label="Fechar menu" @click="closeDrawer">
          <AppIcon name="close" :size="20" :stroke-width="1.9" />
        </button>
      </div>
      <SideNav @navigate="closeDrawer" @logout="logout.ask" @search="goToSearch" />
    </div>

    <main id="conteudo" class="shell__main" tabindex="-1">
      <RouterView v-slot="{ Component, route: current }">
        <component :is="Component" :key="`${String(current.name)}:${String(current.params.id ?? '')}`" />
      </RouterView>
    </main>

    <ConfirmDialog
      :open="logout.confirming.value"
      title="Sair do CentralDesk?"
      description="Você vai precisar entrar de novo para ver seus chamados."
      confirm-label="Sair"
      :busy="logout.busy.value"
      @confirm="logout.confirm"
      @cancel="logout.cancel"
    />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
}
.skip-link {
  position: absolute;
  left: -9999px;
  top: 8px;
  z-index: 60;
  padding: 8px 12px;
  background: var(--text);
  color: #fff;
  border-radius: var(--radius);
}
.skip-link:focus {
  left: 8px;
}
.shell__sidebar {
  flex: none;
  width: var(--sidebar-width);
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
}
.shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.shell__main:focus {
  outline: none;
}
.shell__mobile-header,
.shell__drawer,
.shell__backdrop {
  display: none;
}

@media (max-width: 900px) {
  .shell {
    flex-direction: column;
  }
  .shell__sidebar {
    display: none;
  }
  .shell__mobile-header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 56px;
    padding: 0 6px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }
  .shell__mobile-brand {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
  .shell__bell {
    position: relative;
  }
  .shell__bell-dot {
    position: absolute;
    top: 10px;
    right: 11px;
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--accent);
    border: 2px solid var(--bg);
  }
  .shell__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(15, 15, 15, 0.38);
  }
  .shell__drawer {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    width: min(300px, 86vw);
    background: var(--sidebar);
    box-shadow: 8px 0 24px rgba(15, 15, 15, 0.16);
    overflow-y: auto;
  }
  .shell__drawer[style*='display: none'] {
    display: none;
  }
  .shell__drawer-top {
    display: flex;
    justify-content: flex-end;
    padding: 4px 6px 0;
  }
}
</style>
