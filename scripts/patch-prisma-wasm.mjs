#!/usr/bin/env node
/**
 * patch-prisma-wasm — wires the query-compiler WASM into the generated
 * Prisma client (air-gapped, engineType = "wasm").
 *
 * `prisma generate` emits `config.compilerWasm = undefined` in the generated
 * client (it expects a runtime-provided loader). This script replaces that
 * assignment in node_modules/.prisma/client/{wasm.js,index.js} with a loader
 * that uses the provider-specific query compiler bundled with @prisma/client:
 *   runtime/query_compiler_bg.<provider>.js               (glue/imports)
 *   runtime/query_compiler_bg.<provider>.wasm-base64.js   (engine bytes)
 *
 * Idempotent. Run after every `prisma generate` (prisma-generate.mjs does it).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// detect the active datasource provider from the schema (not the generator's)
const schema = readFileSync(path.join(root, 'packages', 'database', 'prisma', 'schema.prisma'), 'utf8')
const dsBlock = /datasource\s+\w+\s*{([\s\S]*?)}/.exec(schema)
const providerMatch = dsBlock ? /provider\s*=\s*"([^"]+)"/.exec(dsBlock[1]) : null
if (!providerMatch) {
  console.error('[patch-prisma-wasm] could not detect datasource provider in schema.prisma')
  process.exit(1)
}
const provider = providerMatch[1]
const providerWasm = {
  postgresql: 'postgresql',
  cockroachdb: 'cockroachdb',
  mysql: 'mysql',
  sqlite: 'sqlite',
}[provider]
if (!providerWasm) {
  console.error(`[patch-prisma-wasm] no query-compiler mapping for provider "${provider}"`)
  process.exit(1)
}

const runtimeDir = path.dirname(require.resolve('@prisma/client/runtime/query_compiler_bg.postgresql.js'))
const glue = path.join(runtimeDir, `query_compiler_bg.${providerWasm}.js`)
const b64 = path.join(runtimeDir, `query_compiler_bg.${providerWasm}.wasm-base64.js`)
if (!existsSync(glue) || !existsSync(b64)) {
  console.error(`[patch-prisma-wasm] query-compiler files missing for ${providerWasm}:`)
  console.error(`  ${glue}`)
  console.error(`  ${b64}`)
  process.exit(1)
}

const clientDir = path.join(root, 'node_modules', '.prisma', 'client')
const files = ['wasm.js', 'index.js'].map((f) => path.join(clientDir, f)).filter(existsSync)
if (!files.length) {
  console.error('[patch-prisma-wasm] generated client not found — run `node scripts/prisma-generate.mjs` first')
  process.exit(1)
}

const loader = `config.compilerWasm = {
  getRuntime: async () => require(${JSON.stringify(`@prisma/client/runtime/query_compiler_bg.${providerWasm}.js`)}),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = require(${JSON.stringify(`@prisma/client/runtime/query_compiler_bg.${providerWasm}.wasm-base64.js`)})
    return await WebAssembly.compile(Buffer.from(wasm, 'base64'))
  }
}`

let patched = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  if (src.includes('config.compilerWasm = undefined')) {
    writeFileSync(file, src.replace('config.compilerWasm = undefined', loader))
    patched++
  }
}

// The generated WASM engine loaders are written for bundlers (Vite's
// `?module` wasm import). Plain Node's wasm-ESM namespace has no `default`
// export, so `getQueryEngineWasmModule()` resolves to undefined. Rewrite the
// loaders to compile the engine wasm directly with Node's WebAssembly API.
const engineLoader = `import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const wasmPath = fileURLToPath(new URL('./query_engine_bg.wasm', import.meta.url))
const bytes = readFileSync(wasmPath)
const module = await WebAssembly.compile(bytes)

export default { default: module }
`
let loaders = 0
for (const name of ['wasm-worker-loader.mjs', 'wasm-edge-light-loader.mjs']) {
  const file = path.join(clientDir, name)
  if (existsSync(file)) {
    writeFileSync(file, engineLoader)
    loaders++
  }
}
console.log(
  `[patch-prisma-wasm] patched ${patched} client file(s) with the ${providerWasm} query-compiler loader, ${loaders} wasm engine loader(s) rewritten for Node`,
)
