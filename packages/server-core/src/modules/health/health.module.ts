import { Controller, Get, Module } from '@nestjs/common'
import { Public } from '../../common/guards'
import { PrismaService } from '../../common/core.module'

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — process is up. */
  @Public()
  @Get('live')
  live() {
    return { status: 'live', service: 'nearbuy-api', time: new Date().toISOString() }
  }

  /** Liveness alias. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'nearbuy-api', time: new Date().toISOString() }
  }

  /** Readiness — dependencies reachable. */
  @Public()
  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`
    return { status: 'ready', service: 'nearbuy-api', checks: { database: 'ok' } }
  }
}

/** Also exposed under /api/v1 for consistency. */
@Controller('health')
export class HealthV1Controller extends HealthController {}

@Module({
  controllers: [HealthController, HealthV1Controller],
})
export class HealthModule {}
