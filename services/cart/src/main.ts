import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, CartModule, CheckoutModule } from '../../../packages/server-core/src'

void bootstrapHttp('cart', createServiceModule('cart', [CartModule, CheckoutModule]))
