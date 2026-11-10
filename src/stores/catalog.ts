import { defineStore } from 'pinia'
import { ref } from 'vue'
import { catalogApi, type Category, type Department, type Priority } from '@/api'

// Listas que quase não mudam (categorias, prioridades, departamentos): busca uma vez e reaproveita.

export const useCatalogStore = defineStore('catalog', () => {
  const categories = ref<Category[]>([])
  const priorities = ref<Priority[]>([])
  const departments = ref<Department[]>([])

  let ticketOptions: Promise<void> | null = null
  let departmentList: Promise<void> | null = null

  function loadTicketOptions(): Promise<void> {
    ticketOptions ??= Promise.all([catalogApi.categories(), catalogApi.priorities()])
      .then(([loadedCategories, loadedPriorities]) => {
        categories.value = loadedCategories
        priorities.value = loadedPriorities
      })
      .catch((error) => {
        ticketOptions = null
        throw error
      })
    return ticketOptions
  }

  function loadDepartments(): Promise<void> {
    departmentList ??= catalogApi
      .departments()
      .then((loaded) => {
        departments.value = loaded
      })
      .catch((error) => {
        departmentList = null
        throw error
      })
    return departmentList
  }

  async function reloadCategories(): Promise<void> {
    categories.value = await catalogApi.categories()
  }

  return { categories, priorities, departments, loadTicketOptions, loadDepartments, reloadCategories }
})
