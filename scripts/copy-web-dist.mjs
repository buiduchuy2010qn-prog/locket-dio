import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'apps', 'web', 'dist')

if (!existsSync(src)) {
  console.error('[copy-web-dist] Missing apps/web/dist')
  process.exit(1)
}

for (const destName of ['dist', 'public']) {
  const dest = join(root, destName)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  // SPA fallback for hosts that read _redirects
  writeFileSync(join(dest, '_redirects'), '/*    /index.html   200\n')
  console.log(`[copy-web-dist] OK → ${destName}/`)
}
