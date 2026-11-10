import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Em desenvolvimento, /api vai para o back-end local. Para o navegador, front e API ficam na
// mesma origem: os cookies de sessão (HttpOnly, SameSite=Strict) funcionam sem CORS.
// Em produção quem repassa /api é o nginx (Dockerfile e nginx/default.conf.template).
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')
const apiTarget = env.VITE_API_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Os cookies Path=/auth da API passam a valer em /api/auth
        cookiePathRewrite: { '/auth': '/api/auth' },
      },
    },
  },
})
