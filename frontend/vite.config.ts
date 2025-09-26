import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '../', '')

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.FRONTEND_PORT || '5173'),
    },
    define: {
      'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(env.BACKEND_PORT || '8080'),
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [],
    }
  }
})
