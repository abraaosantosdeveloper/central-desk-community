<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { COMPANY_NAME } from '@/config'
import { useNavigation } from '@/composables/useNavigation'
import { roleLabel, useAuthStore } from '@/stores/auth'
import AppIcon from '../AppIcon.vue'
import BrandMark from '../BrandMark.vue'
import UserAvatar from '../UserAvatar.vue'

const emit = defineEmits<{ navigate: []; logout: []; search: [] }>()

const auth = useAuthStore()
const route = useRoute()
const { sections } = useNavigation()

/** Item ativo pelo nome da rota; o detalhe do chamado não acende nenhum. */
const activeKey = computed(() => String(route.meta.navKey ?? route.name ?? ''))
</script>

<template>
  <nav aria-label="Navegação principal" class="nav">
    <div class="nav__workspace">
      <BrandMark :size="30" />
      <span class="nav__workspace-text">
        <span class="nav__workspace-name">CentralDesk</span>
        <span class="nav__workspace-org">{{ COMPANY_NAME }}</span>
      </span>
    </div>

    <button type="button" class="nav__item nav__item--muted" @click="emit('search')">
      <AppIcon name="search" />
      <span class="nav__label">Buscar chamados</span>
    </button>

    <template v-for="section in sections" :key="section.key">
      <p v-if="section.title" class="nav__section">{{ section.title }}</p>
      <RouterLink
        v-for="item in section.items"
        :key="item.key"
        :to="item.to"
        class="nav__item"
        :class="{ 'is-active': activeKey === item.key }"
        :aria-current="activeKey === item.key ? 'page' : undefined"
        @click="emit('navigate')"
      >
        <AppIcon :name="item.icon" />
        <span class="nav__label">{{ item.label }}</span>
        <template v-if="item.count">
          <span v-if="item.badge" class="badge" :aria-label="item.countLabel">{{ item.count }}</span>
          <span v-else class="nav__count" :aria-label="item.countLabel">{{ item.count }}</span>
        </template>
      </RouterLink>
    </template>

    <div class="nav__divider" />

    <RouterLink
      :to="{ name: 'profile' }"
      class="nav__item nav__item--profile"
      :class="{ 'is-active': activeKey === 'profile' }"
      @click="emit('navigate')"
    >
      <UserAvatar :name="auth.currentUser?.fullName ?? ''" :size="24" />
      <span class="nav__profile-text">
        <span class="truncate">{{ auth.currentUser?.fullName }}</span>
        <span class="nav__profile-role truncate">{{ roleLabel(auth.currentUser) }}</span>
      </span>
    </RouterLink>
    <button type="button" class="nav__item nav__item--muted" @click="emit('logout')">
      <AppIcon name="logout" />
      <span class="nav__label">Sair</span>
    </button>
  </nav>
</template>

<style scoped>
.nav {
  width: 100%;
  padding: 10px 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
}
.nav__workspace {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 10px;
}
.nav__workspace-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.nav__workspace-name {
  font-weight: 600;
  line-height: 18px;
}
.nav__workspace-org {
  font-size: 12px;
  line-height: 16px;
  color: var(--muted);
}
.nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-2);
  font-weight: 500;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
}
.nav__item > svg {
  flex: none;
  color: var(--faint);
}
.nav__item:hover {
  background: var(--hover);
  color: var(--text);
}
.nav__item.is-active {
  background: var(--active);
  color: var(--text);
  font-weight: 600;
}
.nav__item--muted {
  color: var(--muted);
}
.nav__label {
  flex: 1;
  min-width: 0;
}
.nav__count {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.nav__section {
  margin: 14px 10px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--faint);
}
.nav__divider {
  height: 1px;
  background: var(--border);
  margin: 14px 10px;
}
.nav__item--profile {
  min-height: 48px;
}
.nav__profile-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  line-height: 18px;
}
.nav__profile-role {
  font-size: 12px;
  line-height: 16px;
  color: var(--muted);
  font-weight: 400;
}
</style>
