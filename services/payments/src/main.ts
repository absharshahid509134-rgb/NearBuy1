import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, PaymentsModule } from '../../../packages/server-core/src'

void bootstrapHttp('payments', createServiceModule('payments', [PaymentsModule]))
