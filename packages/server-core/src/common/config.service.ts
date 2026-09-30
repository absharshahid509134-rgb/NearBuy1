import { Injectable } from '@nestjs/common'
import { loadAppEnv } from './env'
import type { Env } from '@nearbuy/config'

/** Typed, validated environment access for the whole API. */
@Injectable()
export class ConfigService {
  readonly env: Env = loadAppEnv()
}
