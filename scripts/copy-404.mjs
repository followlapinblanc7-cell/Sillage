import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
const index = resolve(dist, 'index.html')
const notFound = resolve(dist, '404.html')

if (!existsSync(index)) {
  console.error('copy-404: dist/index.html missing — run vite build first')
  process.exit(1)
}

copyFileSync(index, notFound)
console.log('copy-404: wrote dist/404.html (SPA fallback for GitHub Pages)')
