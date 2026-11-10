<script setup lang="ts">
import { computed, ref } from 'vue'

// Código de 6 dígitos em seis caixas. Colar o código inteiro em qualquer caixa preenche todas,
// e o primeiro campo pede ao celular a sugestão do código (autocomplete="one-time-code").

const model = defineModel<string>({ required: true })
const props = withDefaults(defineProps<{ invalid?: boolean; disabled?: boolean; label?: string }>(), {
  invalid: false,
  disabled: false,
  label: 'Código de verificação',
})

const inputs = ref<HTMLInputElement[]>([])
const digits = computed(() => Array.from({ length: 6 }, (_, index) => model.value[index] ?? ''))

function setDigits(value: string, focusIndex?: number) {
  model.value = value.replace(/\D/g, '').slice(0, 6)
  if (focusIndex !== undefined) inputs.value[Math.min(focusIndex, 5)]?.focus()
}

function onInput(index: number, event: Event) {
  const typed = (event.target as HTMLInputElement).value.replace(/\D/g, '')
  if (typed.length > 1) {
    // Colou ou o celular preencheu: distribui a partir desta caixa
    setDigits(model.value.slice(0, index) + typed, index + typed.length)
    return
  }
  const next = digits.value.slice()
  next[index] = typed
  setDigits(next.join(''), typed ? index + 1 : undefined)
  ;(event.target as HTMLInputElement).value = typed
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    const next = digits.value.slice()
    next[index - 1] = ''
    setDigits(next.join(''), index - 1)
    event.preventDefault()
  } else if (event.key === 'ArrowLeft' && index > 0) {
    inputs.value[index - 1]?.focus()
  } else if (event.key === 'ArrowRight' && index < 5) {
    inputs.value[index + 1]?.focus()
  }
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!text) return
  event.preventDefault()
  setDigits(text, Math.min(text.replace(/\D/g, '').length, 5))
}

const activeIndex = computed(() => Math.min(model.value.length, 5))
defineExpose({ focus: () => inputs.value[0]?.focus(), props })
</script>

<template>
  <fieldset class="code">
    <legend class="label code__legend">{{ label }}</legend>
    <div class="code__boxes">
      <input
        v-for="(digit, index) in digits"
        :key="index"
        :ref="(el) => { if (el) inputs[index] = el as HTMLInputElement }"
        class="code__box"
        :class="{ 'is-active': index === activeIndex && !disabled, 'is-invalid': invalid }"
        :value="digit"
        :aria-label="`Dígito ${index + 1}`"
        :aria-invalid="invalid || undefined"
        :autocomplete="index === 0 ? 'one-time-code' : 'off'"
        inputmode="numeric"
        maxlength="6"
        :disabled="disabled"
        @input="onInput(index, $event)"
        @keydown="onKeydown(index, $event)"
        @paste="onPaste"
        @focus="($event.target as HTMLInputElement).select()"
      >
    </div>
    <span class="hint">Você pode colar o código inteiro no primeiro campo.</span>
  </fieldset>
</template>

<style scoped>
.code {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.code__legend {
  padding: 0;
  margin-bottom: 8px;
}
.code__boxes {
  display: flex;
  gap: 8px;
}
.code__box {
  width: 52px;
  height: 56px;
  min-width: 0;
  flex: 0 1 52px;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text);
  background: var(--bg);
}
.code__box:focus,
.code__box.is-active:focus {
  outline: none;
  border: 2px solid var(--accent);
}
.code__box.is-invalid {
  border-color: var(--danger);
}
</style>
