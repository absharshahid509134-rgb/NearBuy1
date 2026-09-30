import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, AiModule } from '../../../packages/server-core/src'

void bootstrapHttp('ai', createServiceModule('ai', [AiModule]))
