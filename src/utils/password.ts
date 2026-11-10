export const MIN_PASSWORD_LENGTH = 8

/** As mesmas regras da API (@StrongPassword): 8 a 72 caracteres, com ao menos uma letra e um número. */
export function passwordRules(password: string) {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH && password.length <= 72,
    letter: /\p{L}/u.test(password),
    digit: /\d/.test(password),
  }
}

export function meetsPasswordRules(password: string): boolean {
  const rules = passwordRules(password)
  return rules.length && rules.letter && rules.digit
}
