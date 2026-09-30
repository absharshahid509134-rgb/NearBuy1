import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, CouponsModule } from '../../../packages/server-core/src'

void bootstrapHttp('coupons', createServiceModule('coupons', [CouponsModule]))
