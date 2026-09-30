/**
 * Post-generate patch for the Prisma client (air-gapped / WASM runtime).
 *
 * The generated client's `#wasm-engine-loader` entry points at a Bun/edge-style
 * loader (`import('./query_engine_bg.wasm')`) that plain Node cannot execute.
 * This script rewrites that loader for Node: read the bundled
 * `query_engine_bg.wasm` from disk and hand a compiled WebAssembly.Module to
 * the wasm runtime. The glue (`query_engine_bg.js`) and the .wasm file are
 * both produced by `prisma generate` (engineType = "wasm") and ship in the
 * generated client directory, so no engine binary downloads are ever needed.
 *
 * Idempotent — safe to run after every `prisma generate`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Locate the generated client dir (node_modules/.prisma/client). */
let clientDir
try {
  clientDir = path.dirname(require.resolve('.prisma/client/wasm.js'))
} catch {
  try {
    clientDir = path.dirname(require.resolve('@prisma/client/wasm'))
  } catch {
    console.error('[postgenerate] generated Prisma client not found — run `prisma generate` first')
    process.exit(1)
  }
}

const gluePath = path.join(clientDir, 'query_engine_bg.js')
const wasmPath = path.join(clientDir, 'query_engine_bg.wasm')
const loaderPath = path.join(clientDir, 'wasm-worker-loader.mjs')

if (!existsSync(gluePath) || !existsSync(wasmPath) || !existsSync(loaderPath)) {
  console.error(
    `[postgenerate] generated client layout changed (expected query_engine_bg.js/.wasm + wasm-worker-loader.mjs in ${clientDir})`,
  )
  process.exit(1)
}

const nodeLoader = `/* Patched by scripts/postgenerate.mjs — Node-compatible WASM loader. */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const bytes = readFileSync(join(dir, 'query_engine_bg.wasm'))
const module = await WebAssembly.compile(bytes)
// The runtime reads (await loader).default — mirror the shape of the
// original raw-wasm import module namespace.
export default { default: module }
`

if (readFileSync(loaderPath, 'utf8').includes('postgenerate.mjs')) {
  console.log('[postgenerate] Node-compatible WASM loader already installed')
} else {
  writeFileSync(loaderPath, nodeLoader)
  console.log('[postgenerate] installed Node-compatible WASM loader')
}
console.log('[postgenerate] done')
