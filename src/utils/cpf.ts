export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Aplica a máscara 000.000.000-00 enquanto a pessoa digita. */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Esconde o começo e o fim do CPF: 529.982.247-25 → •••.982.247-••. */
export function maskCpf(value: string | null | undefined): string {
  const d = onlyDigits(value ?? '')
  if (d.length !== 11) return '—'
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`
}

/** Confere os dois dígitos verificadores do CPF. */
export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const checkDigit = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(d[i]) * (length + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return checkDigit(9) === Number(d[9]) && checkDigit(10) === Number(d[10])
}
