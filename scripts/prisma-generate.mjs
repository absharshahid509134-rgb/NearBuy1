/**
 * prisma-generate — air-gapped Prisma client generation.
 *
 * 1. Installs offline engine stubs (scripts/prisma-stub-engines.mjs).
 * 2. Points PRISMA_SCHEMA_ENGINE_BINARY / PRISMA_QUERY_ENGINE_LIBRARY at the
 *    stubs so the CLI never contacts binaries.prisma.sh.
 * 3. Runs `prisma generate` (Prisma 6 computes the DMMF with its bundled
 *    WASM schema engine; the client embeds the bundled WASM query engine via
 *    `engineType = "wasm"` in the schema).
 *
 * Usage from the repo root:  node scripts/prisma-generate.mjs
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await import('./prisma-stub-engines.mjs')

let enginesDir
try {
  enginesDir = path.dirname(require.resolve('@prisma/engines/package.json'))
} catch {
  console.error('[prisma-generate] @prisma/engines not installed — run `npm install` first')
  process.exit(1)
}

const env = {
  ...process.env,
  PRISMA_SCHEMA_ENGINE_BINARY: path.join(enginesDir, 'schema-engine-debian-openssl-3.0.x'),
  PRISMA_QUERY_ENGINE_LIBRARY: path.join(enginesDir, 'libquery_engine-debian-openssl-3.0.x.so.node'),
}

const result = spawnSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'generate', '--schema', path.join(root, 'packages', 'database', 'prisma', 'schema.prisma')], {
  stdio: 'inherit',
  env,
})
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)

// the generated wasm client ships without a query-compiler loader — wire it in
const patch = spawnSync(process.execPath, [path.join(root, 'scripts', 'patch-prisma-wasm.mjs')], { stdio: 'inherit' })
process.exit(patch.status ?? 1)
