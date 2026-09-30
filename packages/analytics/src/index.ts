import type { AnalyticsEventName } from '@nearbuy/types'
/**
 * @nearbuy/analytics — provider-agnostic event tracking.
 * No vendor-specific tracking sprinkled through the app: swap the sink here.
 */

export interface AnalyticsEvent {
  name: AnalyticsEventName
  userId?: string
  anonId?: string
  props?: Record<string, unknown>
  at: number
}

export interface AnalyticsProvider {
  readonly name: string
  track(event: AnalyticsEvent): void
}

export class ConsoleAnalytics implements AnalyticsProvider {
  readonly name = 'console'
  track(event: AnalyticsEvent): void {
    if (process.env.NODE_ENV === 'test') return
    console.log(`[analytics] ${event.name}`, event.props ?? {})
  }
}

/** Buffers events for batch dispatch (segment/warehouse adapter can consume). */
export class BufferedAnalytics implements AnalyticsProvider {
  readonly name = 'buffered'
  private buffer: AnalyticsEvent[] = []
  constructor(private readonly sink: AnalyticsProvider) {}

  track(event: AnalyticsEvent): void {
    this.buffer.push(event)
    if (this.buffer.length >= 50) this.flush()
  }

  flush(): void {
    for (const e of this.buffer.splice(0)) this.sink.track(e)
  }
}

export function createAnalytics(): AnalyticsProvider {
  return new BufferedAnalytics(new ConsoleAnalytics())
}
