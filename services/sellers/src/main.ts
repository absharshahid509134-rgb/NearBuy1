import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, SellersModule, StoresModule } from '../../../packages/server-core/src'

void bootstrapHttp('sellers', createServiceModule('sellers', [SellersModule, StoresModule]))
