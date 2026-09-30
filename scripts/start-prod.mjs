#!/usr/bin/env node
/**
 * Production entry — one process, one port:
 *  - the built SPA (dist/) at /
 *  - the compiled API (dist-api/) at /api/v1
 *  - /health /ready /live
 *  - /uploads (seller photos)
 *
 *   npm run build:prod && npm start
 *
 * Environment (see .env.example / docs/PRODUCTION.md):
 *   DATABASE_URL, AUTH_SECRET/JWT_SECRET/CHANGE_TOKEN, WEB_URL, PORT
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const apiDist = path.join(root, 'dist-api', 'backend', 'src', 'main.js')

// build on demand so `npm start` is never served from stale or missing artifacts
if (!existsSync(path.join(dist, 'index.html'))) {
  console.log('[start] SPA build missing — running `npm run build`')
  const r = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', cwd: root })
  if (r.status !== 0) process.exit(1)
}
if (!existsSync(apiDist)) {
  console.log('[start] API build missing — compiling TypeScript')
  const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.api.build.json'], { stdio: 'inherit', cwd: root })
  if (r.status !== 0) process.exit(1)
}

// load .env.production / .env if present (existing process env wins)
for (const file of ['.env.production', '.env']) {
  const p = path.join(root, file)
  if (existsSync(p)) {
    for (const line of (await import('node:fs')).readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    break
  }
}

const port = process.env.PORT ?? '8080'
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: port,
  NEARBUY_STATIC_DIR: dist,
  NEARBUY_UPLOAD_ROOT: path.join(root, 'public', 'uploads'),
  NEARBUY_ENV: 'production',
}
// fail fast with a clear message instead of a cryptic Prisma error
if (!env.DATABASE_URL) {
  console.error('[start] DATABASE_URL is not set. Copy .env.example to .env.production and configure it there (host, user, password, database).')
  process.exit(1)
}

console.log(`[start] NearBuy production server → http://0.0.0.0:${port} (API /api/v1, health /health)`)
const child = spawn(process.execPath, [apiDist], { env, cwd: root, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    child.kill(sig)
  })
}
