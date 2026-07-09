/**
 * Copy apps/web/dist → ./dist and ./public for Render static publish paths.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'apps', 'web', 'dist')

if (!existsSync(src)) {
  console.error('[copy-web-dist] Missing apps/web/dist — run web build first')
  process.exit(1)
}

for (const destName of ['dist', 'public']) {
  const dest = join(root, destName)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[copy-web-dist] ${src} → ${dest}`)
}
