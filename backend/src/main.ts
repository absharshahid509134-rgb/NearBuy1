import 'reflect-metadata'
import { bootstrapHttp } from '../../packages/server-core/src'
import { AppModule } from '../../packages/server-core/src/app.module'

// Gateway = single-process composition of every module (local dev + BFF).
void bootstrapHttp('gateway', AppModule)
