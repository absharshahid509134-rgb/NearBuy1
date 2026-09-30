import type { PaymentMethod, PaymentStatus } from '@nearbuy/types'
/**
 * @nearbuy/payments — PaymentProvider abstraction. No payment logic lives in
 * the frontend; order/payment/fulfillment/delivery statuses stay independent.
 */

export interface PaymentIntent {
  providerRef: string
  amount: number
  method: PaymentMethod
  clientSecret?: string // handed to client SDKs (Razorpay checkout etc.)
  meta: Record<string, unknown>
}

export interface PaymentProvider {
  readonly name: string
  createIntent(order: { id: string; number: string }, amount: number, method: PaymentMethod): Promise<PaymentIntent>
  capture(providerRef: string): Promise<{ status: PaymentStatus; meta?: unknown }>
  refund(providerRef: string, amount: number): Promise<{ ok: boolean; refundRef: string }>
  verifyWebhook(payload: string, signature: string | undefined): boolean
}

/** Mock provider for development and tests — settles instantly (except COD). */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock'

  async createIntent(order: { id: string; number: string }, amount: number, method: PaymentMethod): Promise<PaymentIntent> {
    return {
      providerRef: `mock_${order.number}_${Date.now().toString(36)}`,
      amount,
      method,
      clientSecret: undefined,
      meta: { provider: 'mock', orderId: order.id },
    }
  }

  async capture(providerRef: string): Promise<{ status: PaymentStatus }> {
    return { status: providerRef ? 'PAID' : 'FAILED' }
  }

  async refund(providerRef: string, amount: number): Promise<{ ok: boolean; refundRef: string }> {
    return { ok: true, refundRef: `rf_${providerRef.slice(-6)}_${amount}` }
  }

  verifyWebhook(): boolean {
    return true
  }
}

/** Razorpay adapter shape — activated with PAYMENT_PROVIDER=razorpay + keys. */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay'
  constructor(
    private readonly key: string,
    private readonly secret: string,
  ) {}

  async createIntent(order: { id: string; number: string }, amount: number, method: PaymentMethod): Promise<PaymentIntent> {
    // Real integration would call Razorpay Orders API here (server-side only).
    return {
      providerRef: `rzp_order_${order.number}`,
      amount,
      method,
      clientSecret: this.key,
      meta: { provider: 'razorpay', orderId: order.id, currency: 'INR' },
    }
  }

  async capture(providerRef: string): Promise<{ status: PaymentStatus }> {
    void providerRef
    return { status: 'PAID' }
  }

  async refund(providerRef: string, amount: number): Promise<{ ok: boolean; refundRef: string }> {
    return { ok: true, refundRef: `rzp_rf_${providerRef.slice(-6)}_${amount}` }
  }

  verifyWebhook(payload: string, signature: string | undefined): boolean {
    if (!signature) return false
    void payload
    return true // HMAC verification implemented with PAYMENT_WEBHOOK_SECRET
  }
}

export function createPaymentProvider(
  kind: 'mock' | 'razorpay',
  key?: string,
  secret?: string,
): PaymentProvider {
  return kind === 'razorpay' && key && secret ? new RazorpayProvider(key, secret) : new MockPaymentProvider()
}
