import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // The backend (backend/, default port 4000) serves the API; the frontend
    // only ever calls /api/* so no CORS or base-URL config is needed in dev.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
