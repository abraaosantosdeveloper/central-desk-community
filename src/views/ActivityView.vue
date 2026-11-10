<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import LiveIndicator from '@/components/LiveIndicator.vue'
import PageTopbar from '@/components/PageTopbar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useActivityStore, type ActivityCategory, type ActivityItem } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { formatAgo } from '@/utils/format'

// Notificações. Enquanto a API não expõe /notifications, a lista mostra o que chegou em tempo real
// desde que esta aba foi aberta (o aviso no topo diz isso à pessoa).

const activity = useActivityStore()
const auth = useAuthStore()

const category = ref<ActivityCategory | ''>('')
const onlyUnread = ref(false)

const tabs = computed(() => {
  const list: { value: ActivityCategory | ''; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'TICKETS', label: 'Chamados' },
  ]
  if (auth.isAdmin) list.push({ value: 'ADMINISTRATION', label: 'Administração' })
  return list
})

const visible = computed(() =>
  activity.items.filter(
    (item) => (!category.value || item.category === category.value) && (!onlyUnread.value || !item.read),
  ),
)

const groups = computed(() => {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  const result: { label: string; items: ActivityItem[] }[] = []
  for (const item of visible.value) {
    const day = new Date(item.at).toDateString()
    const label = day === today ? 'Hoje' : day === yesterday ? 'Ontem' : 'Antes'
    const group = result.find((entry) => entry.label === label)
    if (group) group.items.push(item)
    else result.push({ label, items: [item] })
  }
  return result
})

function categoryLabel(value: ActivityCategory) {
  return value === 'TICKETS' ? 'Chamados' : 'Administração'
}
</script>

<template>
  <PageTopbar :crumbs="[{ label: 'Notificações' }]">
    <LiveIndicator />
  </PageTopbar>

  <div class="page page--narrow">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Notificações</h1>
        <p class="page-subtitle">{{ activity.unread ? `${activity.unread} não ${activity.unread === 1 ? 'lida' : 'lidas'}` : 'Tudo lido' }}</p>
      </div>
      <button type="button" class="btn" :disabled="!activity.unread" @click="activity.markAllRead(category || undefined)">
        <AppIcon name="checkDouble" :size="16" :stroke-width="1.8" />Marcar todas como lidas
      </button>
    </div>

    <p class="callout small">
      <AppIcon name="info" :size="16" />
      <span>Aqui aparece o que aconteceu desde que você abriu o CentralDesk nesta aba: chamados novos, mensagens e pedidos de entrada.</span>
    </p>

    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 12px">
      <div class="segmented" role="tablist" aria-label="Categoria">
        <button v-for="tab in tabs" :key="tab.value" type="button" role="tab" :aria-selected="category === tab.value" @click="category = tab.value">{{ tab.label }}</button>
      </div>
      <span style="flex: 1" />
      <label class="checkbox small" style="align-items: center; min-height: 44px; color: var(--text-2)">
        <input v-model="onlyUnread" type="checkbox" style="width: 16px; height: 16px; margin: 0">Só não lidas
      </label>
    </div>

    <p v-if="!visible.length" class="empty">
      {{ onlyUnread || category ? 'Nada com esses filtros.' : 'Nenhuma notificação por enquanto. Quando algo acontecer nos seus chamados, aparece aqui na hora.' }}
    </p>

    <section v-for="group in groups" :key="group.label" :aria-label="group.label" style="display: flex; flex-direction: column">
      <h2 class="group-label" style="margin-bottom: 4px">{{ group.label }}</h2>
      <article v-for="item in group.items" :key="item.id" class="notification" :class="{ 'is-unread': !item.read }">
        <UserAvatar v-if="item.actor" :name="item.actor" :size="32" />
        <span v-else class="notification__icon" aria-hidden="true">
          <AppIcon :name="item.category === 'ADMINISTRATION' ? 'approve' : 'inbox'" :size="16" :stroke-width="1.8" />
        </span>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px">
          <p><strong v-if="item.actor" style="font-weight: 600">{{ item.actor }}</strong> {{ item.text }}</p>
          <span class="xsmall muted">{{ formatAgo(item.at) }} · {{ categoryLabel(item.category) }}</span>
          <RouterLink v-if="item.link" :to="item.link" class="btn btn--sm" style="align-self: flex-start; background: var(--bg)" @click="activity.markRead(item.id)">{{ item.linkLabel }}</RouterLink>
        </div>
        <button v-if="!item.read" type="button" class="notification__dot" aria-label="Marcar como lida" @click="activity.markRead(item.id)"><span /></button>
      </article>
    </section>
  </div>
</template>

<style scoped>
.notification {
  display: flex;
  gap: 12px;
  padding: 14px 8px;
  border-bottom: 1px solid var(--border);
}
.notification.is-unread {
  background: var(--accent-tint-2);
  border-radius: var(--radius);
}
.notification__icon {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: var(--closed-tint);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.notification__dot {
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.notification__dot span {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--accent);
}
</style>
