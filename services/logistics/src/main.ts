import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, DeliveryModule, FulfillmentModule } from '../../../packages/server-core/src'

void bootstrapHttp('logistics', createServiceModule('logistics', [DeliveryModule, FulfillmentModule]))
