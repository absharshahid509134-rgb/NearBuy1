import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, UsersModule, WishlistModule } from '../../../packages/server-core/src'

void bootstrapHttp('users', createServiceModule('users', [UsersModule, WishlistModule]))
