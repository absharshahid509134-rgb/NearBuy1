import 'reflect-metadata'
import { Module, type Type } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { JwtModule } from '@nestjs/jwt'
import { existsSync } from 'node:fs'
import path from 'node:path'
import * as express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { CoreModule } from './common/core.module'
import { ConfigService } from './common/config.service'
import { AllExceptionsFilter, ZodValidationPipe } from './common/errors'
import { EnvelopeInterceptor, LoggingInterceptor, requestIdMiddleware } from './common/http'
import { csrfMiddleware } from './common/csrf'
import { AuthGuard, RolesGuard } from './common/guards'
import { HealthModule } from './modules/health/health.module'

/**
 * Base kernel every deployable service composes: config, prisma (WASM+adapter),
 * JWT, throttling, health/ready, authn/authz guards. Feature modules are the
 * only difference between services — no business logic is duplicated.
 */
export function createServiceModule(name: string, featureModules: Array<Type<unknown>>): Type<unknown> {
  @Module({
    imports: [
      CoreModule.forRoot(),
      JwtModule.registerAsync({
        global: true,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          secret: config.env.AUTH_SECRET,
          signOptions: { expiresIn: config.env.JWT_ACCESS_TTL },
        }),
      }),
      // Global baseline: 300 req/min per IP. Sensitive endpoints (auth)
      // tighten this further with @Throttle on the controller. Multi-instance
      // deployments should back the throttler with a shared store (Redis).
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      HealthModule,
      ...featureModules,
    ],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
  class ServiceModule {}
  Object.defineProperty(ServiceModule, 'name', { value: name.replace(/[^a-zA-Z0-9]/g, '') + 'ServiceModule' })
  return ServiceModule
}

/** Shared HTTP pipeline: envelope, request IDs, logging, validation, swagger. */
export async function bootstrapHttp(serviceName: string, root: Type<unknown>): Promise<void> {
  const app = await NestFactory.create(root, { bufferLogs: true })
  const config = app.get(ConfigService).env

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'live'] })
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cookieParser())
  app.use(requestIdMiddleware())
  app.use(csrfMiddleware())
  app.enableCors({
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  })
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalInterceptors(new LoggingInterceptor(), new EnvelopeInterceptor())
  app.useGlobalFilters(new AllExceptionsFilter())

  const swagger = new DocumentBuilder()
    .setTitle(`NearBuy API — ${serviceName}`)
    .setDescription('NearBuy Storefront-scale commerce API (versioned REST, envelope responses, request IDs).')
    .setVersion('1.0')
    .addCookieAuth('nb_at')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger))

  // ── Production single-port deployment: serve the built storefront ────────
  // When NEARBUY_STATIC_DIR points at the Vite `dist/` build, the SPA is
  // served by the same process and port as the API. API + health routes are
  // registered first and take precedence; every other GET falls back to
  // index.html so client-side deep links (e.g. /customer/orders/123) survive
  // refresh and direct entry. Not set in development — the Vite dev server
  // serves the SPA and proxies /api here.
  const staticDir = process.env.NEARBUY_STATIC_DIR
  if (staticDir) {
    const http = app.getHttpAdapter().getInstance() as express.Express
    if (existsSync(path.join(staticDir, 'index.html'))) {
      http.use('/assets', express.static(path.join(staticDir, 'assets')))
      http.use('/uploads', express.static(path.resolve(process.env.NEARBUY_UPLOAD_ROOT ?? path.join(staticDir, '..', 'public', 'uploads'))))
      http.use(express.static(staticDir))
      http.get(/^(?!\/(api|health|ready|live)(\/|$)).*/, (_req: unknown, res: express.Response) => {
        res.sendFile(path.join(staticDir, 'index.html'))
      })
      console.log(`[nearbuy:${serviceName}] serving storefront from ${staticDir}`)
    } else {
      console.warn(`[nearbuy:${serviceName}] NEARBUY_STATIC_DIR=${staticDir} has no index.html — serving API only`)
    }
  }

  const port = Number(process.env.SERVICE_PORT ?? config.PORT)
  await app.listen(port, '0.0.0.0')
  console.log(`[nearbuy:${serviceName}] listening on :${port} — docs at /api/docs`)
}
