import { computed, getCurrentInstance, onUnmounted, ref } from 'vue'

/** Contagem regressiva em segundos (reenviar código). `label` sai no formato 1:05. */
export function useCountdown() {
  const remaining = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function start(seconds: number) {
    stop()
    remaining.value = Math.max(0, Math.ceil(seconds))
    if (remaining.value === 0) return
    timer = setInterval(() => {
      remaining.value = Math.max(0, remaining.value - 1)
      if (remaining.value === 0) stop()
    }, 1000)
  }

  if (getCurrentInstance()) onUnmounted(stop)

  const active = computed(() => remaining.value > 0)
  const label = computed(() => {
    const minutes = Math.floor(remaining.value / 60)
    const seconds = String(remaining.value % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  })

  return { remaining, active, label, start, stop }
}
