import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import { canAccess, PORTALS, portalForRole, type AuthUser, type Portal } from './portals'

interface AuthResult {
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  checking: boolean
  connectionError: string | null
  retry: () => Promise<void>
  login: (portal: Portal, email: string, password: string) => Promise<AuthUser>
  register: (
    portal: 'customer' | 'seller' | 'rider',
    input: { name: string; email: string; password: string },
  ) => Promise<AuthUser>
  requestOtp: (phone: string) => Promise<{ sent: boolean; devCode?: string }>
  verifyOtp: (code: string, phone: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export class WrongPortalError extends Error {
  constructor(public actual: Portal | null) {
    super(
      actual
        ? `This account belongs to ${PORTALS[actual].name}. Please use that sign-in instead.`
        : 'This account does not have access to a NearBuy workspace yet. Contact support for help.',
    )
    this.name = 'WrongPortalError'
  }
}

// StrictMode remounts effects in development. Share the in-flight refresh so a
// rotating refresh token cannot be used twice at the same time.
let bootstrapPromise: Promise<AuthUser | null> | undefined
function restoreSession(): Promise<AuthUser | null> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        return await api.get<AuthUser>('/auth/me')
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error
        try {
          await api.post('/auth/refresh')
          return await api.get<AuthUser>('/auth/me')
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 401) return null
          throw refreshError
        }
      }
    })().finally(() => {
      bootstrapPromise = undefined
    })
  }
  return bootstrapPromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const retry = useCallback(async () => {
    setChecking(true)
    try {
      setUser(await restoreSession())
      setConnectionError(null)
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'The sign-in service is unavailable.')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void retry()
  }, [retry])

  async function accept(result: AuthResult, portal: Portal): Promise<AuthUser> {
    if (!canAccess(result.user, portal)) {
      // Never keep a cookie from a sign-in made through the wrong portal.
      // The server determines the role; the selected tab never does.
      await api.post('/auth/logout')
      setUser(null)
      throw new WrongPortalError(portalForRole(result.user.role))
    }
    setUser(result.user)
    setConnectionError(null)
    return result.user
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      checking,
      connectionError,
      retry,
      login: async (portal, email, password) =>
        accept(await api.post<AuthResult>('/auth/login', { email, password }), portal),
      register: async (portal, input) =>
        accept(
          await api.post<AuthResult>('/auth/register', { ...input, role: PORTALS[portal].role }),
          portal,
        ),
      requestOtp: (phone) => api.post<{ sent: boolean; devCode?: string }>('/auth/otp/request', { phone }),
      verifyOtp: async (code, phone) =>
        accept(await api.post<AuthResult>('/auth/otp/verify', { code, phone }), 'customer'),
      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error
        }
        setUser(null)
      },
    }),
    [user, checking, connectionError, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be inside AuthProvider')
  return context
}
