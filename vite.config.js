import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The PHP API runs on XAMPP Apache. In dev, /api is proxied to it so session cookies stay same-origin.
  // Set SSIS_API in .env.local (e.g. http://127.0.0.1:8000 for `php -S`) if Apache is not running.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.SSIS_API || 'http://localhost/YULOTECH'
  return {
    base: './',
    plugins: [react()],
    server: { proxy: { '/api': { target, changeOrigin: true } } },
  }
})
