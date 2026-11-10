/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMPANY_NAME?: string
  readonly VITE_SUPPORT_TEAM_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
