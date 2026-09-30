/**
 * prisma-stub-engines — makes `prisma generate` work in air-gapped
 * environments (no access to binaries.prisma.sh).
 *
 * With Prisma 6 + `engineType = "wasm"`, the generated client embeds the
 * bundled WASM query engine and the CLI computes the DMMF with its own WASM
 * schema engine — no native binaries are executed. The CLI still performs an
 * engine *existence check* and downloads binaries when the files are missing.
 * This script plants inert stub files at the expected paths (skipping any
 * download) before `prisma generate` runs.
 *
 * Idempotent. Runs automatically via the `prisma:generate` script.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let enginesDir
try {
  enginesDir = path.dirname(require.resolve('@prisma/engines/package.json'))
} catch {
  console.error('[prisma-stub-engines] @prisma/engines not installed — run `npm install` first')
  process.exit(1)
}

const schemaStub = path.join(enginesDir, 'schema-engine-debian-openssl-3.0.x')
const queryStub = path.join(enginesDir, 'libquery_engine-debian-openssl-3.0.x.so.node')

const schemaScript = `#!/bin/sh
# NearBuy offline stub. The Prisma 6 CLI uses its bundled WASM schema engine
# for DMMF; this file only satisfies the engine-existence check. It fails
# loudly if ever invoked for real schema work.
if [ "$1" = "--version" ] || [ "$1" = "-v" ]; then
  echo "wasm-backed offline stub (scripts/prisma-stub-engines.mjs)"
  exit 0
fi
echo "nearbuy-offline-stub: native schema-engine unavailable in this environment" >&2
exit 1
`

let changed = false
if (!existsSync(schemaStub)) {
  writeFileSync(schemaStub, schemaScript)
  chmodSync(schemaStub, 0o755)
  changed = true
}
if (!existsSync(queryStub) && readSize(queryStub) < 64) {
  writeFileSync(
    queryStub,
    'NearBuy offline stub — the WASM query engine (engineType = "wasm") is used at runtime.\n',
  )
  changed = true
}

function readSize(file) {
  try {
    return require('node:fs').statSync(file).size
  } catch {
    return 0
  }
}

console.log(changed ? '[prisma-stub-engines] installed offline engine stubs' : '[prisma-stub-engines] stubs already present')
