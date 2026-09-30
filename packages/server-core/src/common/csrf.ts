import type { NextFunction, Request, Response } from 'express'
/**
 * CSRF — double-submit cookie validation for cookie-authenticated mutations.
 *
 * Authenticated sessions ride in httpOnly cookies (nb_at/nb_rt), so cross-site
 * form POSTs must be blocked. The login/register/refresh flow issues a
 * readable nb_csrf cookie; every mutating request must echo it in the
 * X-CSRF-Token header. SameSite=Lax is the first line, this is the second.
 *
 * Public auth endpoints (login/register/otp) have no session cookie yet and
 * are rate-limited instead; logout is excluded so an expired-but-present
 * session can always be cleared.
 */
const EXEMPT_PATHS = new Set(['/api/v1/auth/logout'])

export function csrfMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {}
    const sessionId = cookies.nb_at
    const path = req.path
    if (!sessionId || EXEMPT_PATHS.has(path)) return next()

    const headerToken = req.header('x-csrf-token')
    const cookieToken = cookies.nb_csrf
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISMATCH',
          message: 'Your session token is out of date. Please refresh the page and try again.',
        },
        requestId: req.requestId,
      })
      return
    }
    next()
  }
}
