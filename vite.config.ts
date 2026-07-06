import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://<user>.github.io/SynchRock/ in production (GitHub Pages project site).
  base: command === 'build' ? '/SynchRock/' : '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
}))
