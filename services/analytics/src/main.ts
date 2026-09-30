import 'reflect-metadata'
import { bootstrapHttp, createServiceModule } from '../../../packages/server-core/src'

// Deployable shell over the shared kernel (health/ready live from day one).
// Feature module(s) land in the phase marked in docs/ARCHITECTURE.md §3.
void bootstrapHttp('analytics', createServiceModule('analytics', []))
