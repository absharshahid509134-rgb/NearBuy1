import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AllExceptionsFilter, ZodValidationPipe } from './common/errors'
import { EnvelopeInterceptor, LoggingInterceptor, requestIdMiddleware } from './common/http'
import { ConfigService } from './common/config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService).env

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'live'] })
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cookieParser())
  app.use(requestIdMiddleware())
  app.enableCors({
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  })
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalInterceptors(new LoggingInterceptor(), new EnvelopeInterceptor())
  app.useGlobalFilters(new AllExceptionsFilter())

  const swagger = new DocumentBuilder()
    .setTitle('NearBuy API')
    .setDescription(
      'NearBuy — What You Need, Already Nearby. Versioned REST API for the Local Commerce OS: search, nearby inventory, reservations, orders, fulfillment, delivery and admin.',
    )
    .setVersion('1.0')
    .addCookieAuth('nb_at')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swagger)
  SwaggerModule.setup('api/docs', app, document)

  await app.listen(config.PORT, '0.0.0.0')
  console.log(`NearBuy API listening on :${config.PORT} — docs at /api/docs`)
}

void bootstrap()
