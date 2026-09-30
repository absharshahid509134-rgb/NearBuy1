import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { map, Observable, tap } from 'rxjs'
import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { envelope } from './errors'
/**
 * HTTP plumbing: request IDs, structured logging, envelopes, pagination.
 */

/** Prisma serializes Decimal columns as strings ("68", "68.00") — clients
 *  expect plain numbers for money. Normalizes an order (and its items,
 *  payment) for JSON responses. */
function toMoney(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

export function orderToJson<T = any>(order: any): T {
  if (!order) return order as T
  return {
    ...order,
    subtotal: toMoney(order.subtotal),
    deliveryFee: toMoney(order.deliveryFee),
    discount: toMoney(order.discount),
    total: toMoney(order.total),
    items: (order.items ?? []).map((i: any) => ({ ...i, unitPrice: toMoney(i.unitPrice) })),
    payment: order.payment ? { ...order.payment, amount: toMoney(order.payment.amount) } : order.payment,
  } as T
}

/** Per-request ID middleware — echoed in responses and every log line. */
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id')
    req.requestId = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID()
    res.setHeader('X-Request-Id', req.requestId)
    next()
  }
}

/** Structured API logging — never logs secrets or full auth headers. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const start = Date.now()
    return next.handle().pipe(
      tap(() => {
        const level = 'INFO'
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            service: 'nearbuy-api',
            event: 'http_request',
            level,
            method: req.method,
            path: req.path,
            durationMs: Date.now() - start,
            userId: req.user?.id ? hashRef(req.user.id) : undefined,
          }),
        )
      }),
    )
  }
}

/** Stable non-reversible-ish reference for logs (privacy). */
export function hashRef(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `u_${(h >>> 0).toString(36)}`
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>()
    return next
      .handle()
      .pipe(map((data) => envelope(data instanceof Result ? data.data : data ?? null, req.requestId ?? 'unknown', data instanceof Result ? data.meta : undefined)))
  }
}

/** Controllers return Result to attach pagination meta. */
export class Result<T> {
  constructor(
    readonly data: T,
    readonly meta?: { nextCursor?: string | null; total?: number },
  ) {}
}

/** Cursor pagination helper for large datasets. */
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
): { rows: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return { rows: page, nextCursor: hasMore ? page[page.length - 1].id : null }
}

export function metaOf(result: { rows: unknown[]; nextCursor: string | null }, total?: number) {
  return { nextCursor: result.nextCursor, total }
}
