// Textos da marca. Vêm das variáveis VITE_* (ver .env.example); sem elas, ficam os nomes genéricos do portfólio.

export const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME?.trim() || 'Empresa Modelo'

/** Nome do setor que atende os chamados (o mesmo cadastrado no banco). */
export const SUPPORT_TEAM_NAME = import.meta.env.VITE_SUPPORT_TEAM_NAME?.trim() || 'TI & Suporte'

/** Exemplo de e-mail para os campos. O cadastro é aberto: qualquer domínio é aceito. */
export const EMAIL_PLACEHOLDER = 'nome@dominio.com.br'
