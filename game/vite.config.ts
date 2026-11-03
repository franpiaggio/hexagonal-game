import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Every folder in demos/ with an index.html becomes its own page.
const demosDir = resolve(import.meta.dirname, 'demos')
const demoPages = Object.fromEntries(
  readdirSync(demosDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(demosDir, entry.name, 'index.html')))
    .map((entry) => [entry.name, resolve(demosDir, entry.name, 'index.html')]),
)

export default defineConfig({
  // Relative base so the build works on any host or subpath (Vercel, Netlify, GitHub Pages, itch.io).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), ...demoPages },
    },
  },
})
