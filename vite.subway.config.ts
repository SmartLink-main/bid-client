import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const harnessRoot = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(harnessRoot, '../bid-client')

export default defineConfig({
  root: frontendRoot,
  plugins: [react(), tailwindcss()],
  server: {
    strictPort: true,
  },
})
