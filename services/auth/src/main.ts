import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, AuthModule } from '../../../packages/server-core/src'

void bootstrapHttp('auth', createServiceModule('auth', [AuthModule]))
