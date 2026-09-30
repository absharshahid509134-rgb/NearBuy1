import {
  ArgumentMetadata,
  BadRequestException,
  ExceptionFilter,
  Catch,
  HttpException,
  Injectable,
  PipeTransform,
} from '@nestjs/common'
import { ZodSchema } from 'zod'
/**
 * Standard API error format + Zod validation pipe + success envelope helpers.
 * Errors never expose stack traces to clients.
 */

export class ApiError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status = 400,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status)
  }
}

export const Errors = {
  badRequest: (message: string, details?: unknown) => new ApiError('BAD_REQUEST', message, 400, details),
  unauthorized: (message = 'Authentication required.') => new ApiError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'You do not have access to this resource.') => new ApiError('FORBIDDEN', message, 403),
  notFound: (message = 'Not found.') => new ApiError('NOT_FOUND', message, 404),
  conflict: (message: string, code = 'CONFLICT') => new ApiError(code, message, 409),
  outOfStock: (message = 'Not enough stock available.') => new ApiError('OUT_OF_STOCK', message, 409),
  invalidTransition: (message: string) => new ApiError('INVALID_TRANSITION', message, 409),
  reservationExpired: () =>
    new ApiError('RESERVATION_EXPIRED', 'This reservation is no longer active.', 409),
  gone: (code: string, message: string) => new ApiError(code, message, 410),
  tooMany: (message = 'Too many requests. Please retry later.') => new ApiError('RATE_LIMITED', message, 429),
}

/** Validate request input against a Zod schema (DTO validation for every endpoint). */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!this.schema) return value
    const result = this.schema.safeParse(metadata.type === 'param' ? value : value ?? {})
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request.',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
    return result.data
  }
}

export interface ApiOk<T> {
  success: true
  data: T
  requestId: string
  meta?: { nextCursor?: string | null; total?: number }
}

/** Normalized response envelope. */
export function envelope<T>(
  data: T,
  requestId: string,
  meta?: { nextCursor?: string | null; total?: number },
): ApiOk<T> {
  return meta ? { success: true, data, requestId, meta } : { success: true, data, requestId }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: import('@nestjs/common').ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()
    const requestId: string = req?.requestId ?? 'unknown'

    if (exception instanceof ApiError) {
      return res.status(exception.getStatus()).json({
        success: false,
        error: { code: exception.code, message: exception.message, details: exception.details },
        requestId,
      })
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse() as { code?: string; message?: string; details?: unknown }
      const status = exception.getStatus()
      return res.status(status).json({
        success: false,
        error: {
          code: body.code ?? (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR'),
          message: typeof body.message === 'string' ? body.message : exception.message,
          details: body.details ?? (typeof body === 'object' ? body.message : undefined),
        },
        requestId,
      })
    }
    // Unknown error — log server-side, generic message to client.
    console.error('[error]', requestId, exception)
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
      requestId,
    })
  }
}
