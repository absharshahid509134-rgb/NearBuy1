/**
 * NearBuy API client — versioned REST envelope {success,data,requestId,meta?}.
 * Browser calls use relative URLs (Next rewrites proxy to the gateway, so the
 * httpOnly nb_at/nb_rt cookies are first-party). Mutations carry the
 * double-submit CSRF token from the readable nb_csrf cookie.
 */
export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(body: ApiErrorBody, status: number) {
    super(body.message)
    this.code = body.code
    this.status = status
    this.details = body.details
  }
}

export interface RequestOptions {
  json?: unknown
  cookie?: string
  cache?: RequestCache
  signal?: AbortSignal
}

function apiBase(): string {
  return typeof window === 'undefined' ? process.env.API_URL ?? 'http://127.0.0.1:4000' : ''
}

function csrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie.split('; ').find((c) => c.startsWith('nb_csrf='))?.split('=')[1]
}

export async function apiFetch<T>(path: string, opts: RequestOptions & { method?: string } = {}): Promise<T> {
  const method = opts.method ?? (opts.json === undefined ? 'GET' : 'POST')
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.json !== undefined) headers['content-type'] = 'application/json'
  if (opts.cookie) headers['cookie'] = opts.cookie
  if (method !== 'GET') {
    const csrf = csrfToken()
    if (csrf) headers['x-csrf-token'] = csrf
  }

  const res = await fetch(`${apiBase()}/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: opts.cache ?? 'no-store',
    signal: opts.signal,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  })

  let body: { success: boolean; data?: T; error?: ApiErrorBody }
  try {
    body = (await res.json()) as typeof body
  } catch {
    throw new ApiError({ code: 'BAD_RESPONSE', message: `Unexpected response (${res.status})` }, res.status)
  }
  if (!body.success || body.data === undefined) {
    throw new ApiError(body.error ?? { code: 'UNKNOWN', message: 'Request failed' }, res.status)
  }
  return body.data
}

export const api = {
  get: <T,>(path: string, opts?: RequestOptions) => apiFetch<T>(path, opts),
  post: <T,>(path: string, json?: unknown, opts?: RequestOptions) => apiFetch<T>(path, { ...opts, json: json ?? {} }),
  patch: <T,>(path: string, json?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', json: json ?? {} }),
  del: <T,>(path: string, opts?: RequestOptions) => apiFetch<T>(path, { ...opts, method: 'DELETE' }),
}
