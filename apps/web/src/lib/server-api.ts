import { cookies } from 'next/headers'
import { headers } from 'next/headers'

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000'

/**
 * Server-side API access for RSC pages. Forwards the user's cookie so
 * authenticated views (account, orders) render server-side.
 */
export async function apiServer<T>(path: string): Promise<T | null> {
  const jar = cookies()
  const h: Record<string, string> = { accept: 'application/json' }
  const cookieHeader = jar.toString()
  if (cookieHeader) h['cookie'] = cookieHeader
  const fwd = headers().get('x-forwarded-for')
  if (fwd) h['x-forwarded-for'] = fwd
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, { headers: h, cache: 'no-store' })
    const body = (await res.json()) as { success: boolean; data?: T }
    return body.success ? (body.data ?? null) : null
  } catch {
    return null
  }
}
