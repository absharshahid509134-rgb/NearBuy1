import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, NotificationsModule } from '../../../packages/server-core/src'

void bootstrapHttp('notifications', createServiceModule('notifications', [NotificationsModule]))
