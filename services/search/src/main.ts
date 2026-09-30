import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, SearchModule } from '../../../packages/server-core/src'

void bootstrapHttp('search', createServiceModule('search', [SearchModule]))
