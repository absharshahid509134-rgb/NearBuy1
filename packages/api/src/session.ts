/**
 * Session helpers — cookie-auth first (nb_at httpOnly is set by the gateway and
 * flows first-party through the Next rewrite proxy). The bearer token in the
 * login response is intentionally NOT persisted in localStorage.
 */
import { api } from './client'
import type { AuthUserView, LoginResult, MeView } from './types'

export interface RegisterInput {
  email: string
  password: string
  name: string
  phone?: string
  role?: 'CUSTOMER' | 'SELLER'
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/login', { email, password })
}

export async function register(input: RegisterInput): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/register', input)
}

export async function verifyOtp(userId: string, code: string): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/otp/verify', { userId, code })
}

export async function requestOtp(userId: string): Promise<void> {
  await api.post('/auth/otp/request', { userId })
}

export async function me(): Promise<MeView> {
  return api.get<MeView>('/auth/me')
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export type { AuthUserView }
