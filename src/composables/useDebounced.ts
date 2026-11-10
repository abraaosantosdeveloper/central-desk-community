import { ref, watch, type Ref } from 'vue'

/** Cópia de `source` que só muda depois de `delay` ms sem alterações (busca enquanto digita). */
export function useDebounced<T>(source: Ref<T>, delay = 350): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delay)
  })
  return debounced
}
