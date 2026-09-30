import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, ProductsModule } from '../../../packages/server-core/src'

void bootstrapHttp('catalog', createServiceModule('catalog', [ProductsModule]))
