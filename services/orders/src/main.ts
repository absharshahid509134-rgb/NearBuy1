import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, OrdersModule, ReservationsModule } from '../../../packages/server-core/src'

void bootstrapHttp('orders', createServiceModule('orders', [OrdersModule, ReservationsModule]))
