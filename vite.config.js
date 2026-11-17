import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolveApiBaseUrl } from './src/services/apiBaseUrl.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // D1: production builds fail closed at build time when VITE_API_BASE_URL is missing.
  if (command === 'build' && mode === 'production') {
    resolveApiBaseUrl({
      raw: env.VITE_API_BASE_URL,
      prod: true,
      mode,
    })
  }
  return {
    plugins: [react()],
    test: { include: ['src/**/*.test.jsx'] },
    server: {
      port: 3001,
      host: true,
      strictPort: true,
    },
  }
})
