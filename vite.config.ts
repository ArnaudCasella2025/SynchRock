import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://<user>.github.io/SynchRock/ in production (GitHub Pages project site).
  base: command === 'build' ? '/SynchRock/' : '/',
  plugins: [react()],
}))
