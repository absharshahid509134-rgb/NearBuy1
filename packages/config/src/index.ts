import { z } from 'zod'
/**
 * @nearbuy/config — typed environment access + Tailwind preset + i18n dictionaries.
 * Secrets are server-only; never expose non-NEXT_PUBLIC vars to the browser.
 */

export * from './i18n'
export * from './tailwind-preset'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(16).default('dev-only-secret-change-in-production'),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  MAPS_PROVIDER: z.enum(['haversine', 'google']).default('haversine'),
  MAPS_API_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  PAYMENT_KEY: z.string().optional(),
  PAYMENT_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  SEARCH_PROVIDER: z.enum(['sql', 'opensearch']).default('sql'),
  OPENSEARCH_URL: z.string().optional(),
  AI_PROVIDER: z.enum(['grounded', 'llm']).default('grounded'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  WHATSAPP_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
})

export type Env = z.infer<typeof envSchema>

/** Parse KEY=VALUE lines (quotes optional, `#` comments). */
function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Load .env.<NODE_ENV> / .env from the nearest repo root (server-only; lazy
  // require keeps this module importable from shared/iso code).
  const merged: Record<string, string | undefined> = {}
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const envName = source.NODE_ENV ?? 'development'
    let dir = process.cwd()
    for (let up = 0; up < 4; up++) {
      for (const name of [`.env.${envName}`, '.env']) {
        const file = path.join(dir, name)
        if (fs.existsSync(file)) Object.assign(merged, parseEnvFile(fs.readFileSync(file, 'utf8')))
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    // behave like dotenv: expose loaded values to process.env consumers
    for (const [k, v] of Object.entries(merged)) {
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {
    /* browser / restricted runtime — fall back to provided source */
  }
  return envSchema.parse({ ...merged, ...source })
}
export { parseEnvFile }
