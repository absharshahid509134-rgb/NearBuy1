/**
 * UI string layer — components NEVER hard-code user-facing text.
 * `s(key, fallback)` resolves the key in the active locale (en/hi dictionaries
 * live in @nearbuy/config); unknown keys fall back to the provided default.
 */
import { t as tDict, DEFAULT_LOCALE, LOCALES, type Locale } from '@nearbuy/config/i18n'

export { LOCALES, type Locale }

const LOCALE_COOKIE = 'nb_locale'
let locale: Locale = DEFAULT_LOCALE

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : undefined
}

/** Call from app layout (server: cookie header) and once on client load. */
export function initLocale(raw?: string): void {
  const candidate = (raw ?? readCookie(LOCALE_COOKIE) ?? DEFAULT_LOCALE) as Locale
  locale = LOCALES.includes(candidate) ? candidate : DEFAULT_LOCALE
}

export function currentLocale(): Locale {
  return locale
}

export function switchLocale(next: Locale): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000`
  }
  locale = next
  if (typeof location !== 'undefined') location.reload()
}

/** Translate with fallback default (used for keys not yet in dictionaries). */
export function s(key: string, fallback?: string): string {
  const v = tDict(key, locale)
  return v === key && fallback !== undefined ? fallback : v
}

/** Status → semantic tone, shared by orders/payments/fulfillment/returns. */
export function statusTone(status: string): 'success' | 'warning' | 'info' | 'error' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'error'> = {
    COMPLETED: 'success', DELIVERED: 'success', COLLECTED: 'success', APPROVED: 'success',
    REFUNDED: 'success', PAID: 'success', ACTIVE: 'success', VERIFIED: 'success',
    PENDING: 'warning', REQUESTED: 'warning', PACKING: 'warning', PROCESSING: 'warning',
    INSPECTION: 'warning', OPEN: 'warning', LOW_STOCK: 'warning',
    CONFIRMED: 'info', ASSIGNED: 'info', SHIPPED: 'info', READY_FOR_PICKUP: 'info',
    OUT_FOR_DELIVERY: 'info', PICKED_UP: 'info', PLACED: 'info', IN_TRANSIT: 'info',
    CANCELLED: 'error', REJECTED: 'error', FAILED: 'error', EXPIRED: 'error',
    NO_SHOW: 'error', BLOCKED: 'error', OUT_OF_STOCK: 'error', SUSPENDED: 'error',
  }
  return map[status] ?? 'info'
}
