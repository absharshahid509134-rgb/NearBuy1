import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, type Env } from '@nearbuy/config'
/**
 * Environment loading — reads repo-root .env files, then validates via @nearbuy/config.
 * Secrets stay server-side; nothing here is ever sent to the client.
 */

function parseEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

export function repoRoot(): string {
  // backend/src/common → backend/src → backend → root
  return path.resolve(__dirname, '../../..')
}

export function loadAppEnv(): Env {
  const root = repoRoot()
  const files = [
    path.join(root, '.env'),
    path.join(root, `.env.${process.env.NODE_ENV ?? 'development'}`),
    path.join(root, '.env.local'),
  ]
  for (const file of files) {
    for (const [k, v] of Object.entries(parseEnvFile(file))) {
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
  return loadEnv(process.env)
}
