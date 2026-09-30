import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, InventoryModule } from '../../../packages/server-core/src'

void bootstrapHttp('inventory', createServiceModule('inventory', [InventoryModule]))
