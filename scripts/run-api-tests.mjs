#!/usr/bin/env node
/**
 * Orchestrates the API test suite:
 *  1. ensure the throwaway `nearbuy_test` database exists + is migrated
 *  2. seed it when empty
 *  3. start a dedicated gateway on :4100 against that DB (if not already up)
 *  4. run the node:test suite
 *  5. stop the gateway if this script started it
 *
 *   npm run test:api
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://nearbuy:nearbuy@127.0.0.1:5432/nearbuy_test?schema=public'
const PORT = process.env.API_TEST_PORT ?? '4100'
const BASE = `http://127.0.0.1:${PORT}`

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } })
  if (r.status !== 0) {
    console.error(`[test:api] step failed: ${cmd} ${args.join(' ')}`)
    process.exit(1)
  }
}

// 1+2. database — the suite is order- and stock-sensitive, so always start
// from a freshly seeded throwaway DB
run(process.execPath, ['--import', 'tsx', path.join(root, 'scripts', 'migrate.ts')], { DATABASE_URL: TEST_DB })
console.log('[test:api] seeding nearbuy_test (fresh)')
run('node', ['--import', 'tsx', path.join(root, 'packages', 'database', 'prisma', 'seed.ts')], {
  DATABASE_URL: TEST_DB,
})

// 3. gateway
let gateway = null
let alreadyUp = false
try {
  const probe = await fetch(`${BASE}/live`, { signal: AbortSignal.timeout(1500) })
  alreadyUp = probe.ok
} catch {
  alreadyUp = false
}
if (!alreadyUp) {
  // run the COMPILED gateway (identical artifact to the production build) —
  // tsx/esbuild breaks Nest decorator metadata, and the compiled output is
  // the fastest, most faithful choice for integration tests
  const compiledMain = path.join(root, 'dist-api', 'backend', 'src', 'main.js')
  if (!existsSync(compiledMain)) {
    console.log('[test:api] dist-api missing — building API bundle')
    run(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', path.join(root, 'tsconfig.api.build.json')])
    run(process.execPath, [path.join(root, 'scripts', 'gen-api-shims.mjs')])
  }
  console.log(`[test:api] starting gateway on :${PORT} (nearbuy_test)`)
  gateway = spawn(process.execPath, [compiledMain], {
    cwd: root,
    env: {
      ...process.env,
      PORT,
      DATABASE_URL: TEST_DB,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  gateway.stdout.on('data', (d) => process.stdout.write(`[gateway] ${d}`))
  gateway.stderr.on('data', (d) => process.stderr.write(`[gateway] ${d}`))
  // wait for /live
  let up = false
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const r = await fetch(`${BASE}/live`, { signal: AbortSignal.timeout(1000) })
      if (r.ok) {
        up = true
        break
      }
    } catch {}
    if (gateway.exitCode !== null) break
  }
  if (!up) {
    console.error('[test:api] gateway did not start')
    gateway.kill('SIGKILL')
    process.exit(1)
  }
}

// 4. run the suite (node:test — zero extra deps, stdlib assertions)
const suite = spawnSync(process.execPath, ['--import', 'tsx', '--test', path.join(root, 'tests', 'api.test.ts')], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, API_URL: BASE, TEST_DATABASE_URL: TEST_DB },
})

// 5. cleanup
if (gateway) gateway.kill('SIGTERM')
process.exit(suite.status ?? 1)
