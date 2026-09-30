import 'reflect-metadata'
import { bootstrapHttp, createServiceModule, ReviewsModule } from '../../../packages/server-core/src'

void bootstrapHttp('reviews', createServiceModule('reviews', [ReviewsModule]))
