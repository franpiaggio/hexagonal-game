import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works on any host or subpath (Vercel, Netlify, GitHub Pages, itch.io).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
  },
})
