/* First-party cookie API. The Vite server proxies /api to the gateway; the
 * browser never calls localhost or stores access/refresh tokens. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function csrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('nb_csrf='))
    ?.split('=')[1]
}

let refreshing: Promise<void> | undefined
function refreshSession(): Promise<void> {
  // Rotate the refresh cookie once, even when several workspace requests expire
  // together. Access/refresh tokens are never kept in JavaScript storage.
  if (!refreshing)
    refreshing = apiRequest('/auth/refresh', { method: 'POST' }, false)
      .then(() => undefined)
      .finally(() => {
        refreshing = undefined
      })
  return refreshing
}

export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {},
  retryOnExpiry = true,
): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && csrfToken()) headers['X-CSRF-Token'] = csrfToken()!

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('We cannot reach NearBuy right now. Please try again shortly.', 0, 'NETWORK_ERROR')
  }

  let result: { success: boolean; data?: T; error?: { message?: string; code?: string } }
  try {
    result = await response.json()
  } catch {
    throw new ApiError(
      'The server sent an unexpected response. Please try again.',
      response.status,
      'BAD_RESPONSE',
    )
  }
  if (!response.ok || !result.success) {
    if (response.status === 401 && retryOnExpiry && !path.startsWith('/auth/')) {
      await refreshSession()
      return apiRequest<T>(path, options, false)
    }
    throw new ApiError(
      result.error?.message || 'Something went wrong. Please try again.',
      response.status,
      result.error?.code || 'REQUEST_FAILED',
    )
  }
  return result.data as T
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body: unknown = {}) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
}
