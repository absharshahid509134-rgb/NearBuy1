import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Module,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { Role } from '@nearbuy/types'
import {
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@nearbuy/validation'
import { INJECTION, PrismaService, type CacheStore } from '../../common/core.module'
import { ConfigService } from '../../common/config.service'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Public, type AuthUser } from '../../common/guards'
/**
 * Auth — email/password + phone/OTP, JWT access tokens, rotating refresh tokens,
 * role bootstrap (customer/seller/delivery/admin). Roles are server-assigned.
 */

const COOKIE_AT = 'nb_at'
const COOKIE_RT = 'nb_rt'
const COOKIE_CSRF = 'nb_csrf'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

@Controller('auth')
@Throttle({ default: { limit: 50, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(INJECTION.CACHE) private readonly cache: CacheStore,
  ) {}

  private async issueTokens(user: { id: string; role: Role; name: string }, res: Response) {
    const env = this.config.env
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, name: user.name })
    const refreshToken = randomBytes(32).toString('hex')
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
      },
    })
    const secure = env.NODE_ENV === 'production'
    res.cookie(COOKIE_AT, accessToken, { httpOnly: true, sameSite: 'lax', secure, maxAge: env.JWT_ACCESS_TTL * 1000 })
    res.cookie(COOKIE_RT, refreshToken, { httpOnly: true, sameSite: 'lax', secure, maxAge: env.JWT_REFRESH_TTL * 1000 })
    const csrf = randomBytes(16).toString('hex')
    res.cookie(COOKIE_CSRF, csrf, { sameSite: 'lax', secure, maxAge: env.JWT_REFRESH_TTL * 1000 })
    return { accessToken, refreshToken, csrf, user: { id: user.id, role: user.role, name: user.name } }
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const where = body.email ? { email: body.email } : { phone: body.phone }
    const existing = await this.prisma.user.findUnique({ where })
    if (existing) throw Errors.conflict('An account with these details already exists.', 'ACCOUNT_EXISTS')

    // Public role allowlist is enforced by registerSchema. A selected portal
    // never grants a role: the role is assigned here and stored on the user.
    const requested: Role = body.role

    const passwordHash = await bcrypt.hash(body.password, 10)
    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        phone: body.phone,
        passwordHash,
        name: body.name,
        role: requested,
        customerProfile: requested === 'CUSTOMER' ? { create: {} } : undefined,
        deliveryPartner: requested === 'DELIVERY_PARTNER' ? { create: {} } : undefined,
      },
    })
    return this.issueTokens(user, res)
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput, @Res({ passthrough: true }) res: Response) {
    const where = body.email ? { email: body.email } : { phone: body.phone }
    const user = await this.prisma.user.findUnique({ where })
    if (!user?.passwordHash) throw Errors.unauthorized('Invalid credentials.')
    const ok = await bcrypt.compare(body.password, user.passwordHash)
    if (!ok) throw Errors.unauthorized('Invalid credentials.')
    if (user.status !== 'ACTIVE') throw Errors.forbidden('This account is not active.')
    return this.issueTokens(user, res)
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('otp/request')
  async otpRequest(@Body(new ZodValidationPipe(otpRequestSchema)) body: { phone: string }) {
    const code = String(randomInt(100000, 1000000))
    await this.cache.set(`otp:${body.phone}`, code, this.config.env.OTP_TTL_SECONDS)
    // In production this is dispatched via the SMS adapter (outbox). Dev returns the code.
    return {
      sent: true,
      ttlSeconds: this.config.env.OTP_TTL_SECONDS,
      ...(this.config.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    }
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('otp/verify')
  async otpVerify(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: { phone: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const stored = await this.cache.get<string>(`otp:${body.phone}`)
    if (!stored || stored !== body.code) throw Errors.unauthorized('Invalid or expired code.')
    await this.cache.del(`otp:${body.phone}`)
    let user = await this.prisma.user.findUnique({ where: { phone: body.phone } })
    if (user && user.status !== 'ACTIVE') throw Errors.forbidden('This account is not active.')
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone: body.phone, name: 'NearBuy User', role: 'CUSTOMER', phoneVerified: true, customerProfile: { create: {} } },
      })
    }
    return this.issueTokens(user, res)
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {}
    const token = cookies[COOKIE_RT]
    if (!token) throw Errors.unauthorized('Session expired. Please sign in again.')
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
    if (!row || row.revokedAt || row.expiresAt < new Date() || row.user.status !== 'ACTIVE') throw Errors.unauthorized('Session expired. Please sign in again.')
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } })
    return this.issueTokens(row.user, res)
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {}
    if (cookies[COOKIE_RT]) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(cookies[COOKIE_RT]), revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
    for (const c of [COOKIE_AT, COOKIE_RT, COOKIE_CSRF]) res.clearCookie(c)
    return { ok: true }
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user
  }
}

@Module({ controllers: [AuthController] })
export class AuthModule {}
