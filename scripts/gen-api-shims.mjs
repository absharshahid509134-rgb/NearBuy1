#!/usr/bin/env node
/**
 * After compiling the API tree (dist-api/), make the `@nearbuy/*` workspace
 * imports resolve to the COMPILED output instead of the TypeScript source
 * (the workspaces' package.json "main" fields point at src/*.ts).
 *
 * Generates dist-api/node_modules/@nearbuy/<pkg>/ shims that re-export the
 * compiled files. Node's upward node_modules resolution picks them up for
 * everything under dist-api/.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distApi = path.join(root, 'dist-api')
const shimRoot = path.join(distApi, 'node_modules', '@nearbuy')

const PACKAGES = [
  'ai',
  'analytics',
  'config',
  'database',
  'maps',
  'notifications',
  'payments',
  'search',
  'types',
  'validation',
]

if (!existsSync(distApi)) {
  console.error('[shims] dist-api missing — run `npm run build:api` first')
  process.exit(1)
}

// the repo root is "type": "module"; the compiled API is CommonJS
writeFileSync(path.join(distApi, 'package.json'), JSON.stringify({ type: 'commonjs', private: true }, null, 2))

for (const pkg of PACKAGES) {
  const compiled = path.join(distApi, 'packages', pkg, 'src', 'index.js')
  if (!existsSync(compiled)) {
    console.error(`[shims] missing compiled output for @nearbuy/${pkg}: ${compiled}`)
    process.exit(1)
  }
  const dir = path.join(shimRoot, pkg)
  mkdirSync(dir, { recursive: true })
  const rel = path.relative(dir, compiled).split(path.sep).join('/')
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `@nearbuy/${pkg}`, version: '1.0.0', main: 'index.js' }, null, 2))
  writeFileSync(path.join(dir, 'index.js'), `module.exports = require(${JSON.stringify(rel)})\n`)
}
console.log(`[shims] wrote ${PACKAGES.length} workspace shims into dist-api/node_modules/@nearbuy`)
