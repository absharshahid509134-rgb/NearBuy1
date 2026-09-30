import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { Role } from '@nearbuy/types'
import { Errors } from './errors'
/**
 * Authentication & authorization — JWT access tokens (cookie or bearer) plus
 * role guards. Role is taken from the verified token/DB, NEVER from the client.
 */

export const IS_PUBLIC = 'nb:public'
export const ROLES_KEY = 'nb:roles'
export const Public = () => SetMetadata(IS_PUBLIC, true)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export interface AuthUser {
  id: string
  role: Role
  name: string
}

declare module 'express' {
  interface Request {
    user?: AuthUser
    requestId?: string
  }
}

export function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies
  return cookies?.['nb_at']
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])
    const req = ctx.switchToHttp().getRequest<Request>()
    const token = extractToken(req)
    if (!token) {
      if (isPublic) return true
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required.' })
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role; name: string }>(token)
      req.user = { id: payload.sub, role: payload.role, name: payload.name }
      return true
    } catch {
      if (isPublic) return true
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Session expired. Please sign in again.' })
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()])
    if (!roles?.length) return true
    const req = ctx.switchToHttp().getRequest<Request>()
    if (!req.user) throw Errors.forbidden()
    if (!roles.includes(req.user.role) && req.user.role !== 'SUPER_ADMIN') throw Errors.forbidden()
    return true
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  // Optional on @Public() routes (guest search/browse); AuthGuard guarantees
  // presence on protected routes.
  return ctx.switchToHttp().getRequest<Request>().user
})

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest<Request>().requestId ?? 'unknown'
})
