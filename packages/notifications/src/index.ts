import type { NotificationChannel, NotificationEvent } from '@nearbuy/types'
/**
 * @nearbuy/notifications — event-based notification bus with channel adapters.
 * IN_APP is persisted via injected ports; PUSH/EMAIL/SMS/WHATSAPP are queued
 * (outbox) and dispatched by workers — WhatsApp-ready by design.
 */
export type { NotificationChannel, NotificationEvent } from '@nearbuy/types'

export interface NotificationMessage {
  event: NotificationEvent
  userId: string
  title: string
  body: string
  channels: NotificationChannel[]
  meta?: Record<string, unknown>
}

export interface NotificationPorts {
  /** Persist in-app notification. */
  persistInApp(msg: NotificationMessage): Promise<void>
  /** Queue outbound message (email/SMS/push/WhatsApp worker). */
  enqueueOutbound(msg: NotificationMessage, channel: NotificationChannel): Promise<void>
}

export class NotificationBus {
  constructor(private readonly ports: NotificationPorts) {}

  async emit(msg: NotificationMessage): Promise<void> {
    for (const channel of msg.channels) {
      if (channel === 'IN_APP') {
        await this.ports.persistInApp(msg)
      } else {
        await this.ports.enqueueOutbound(msg, channel)
        // Development visibility — never log sensitive payloads.
        if (process.env.NODE_ENV !== 'test') {
          console.log(`[notify:${channel.toLowerCase()}] ${msg.event} → ${msg.title}`)
        }
      }
    }
  }

  orderConfirmed(userId: string, orderNumber: string) {
    return this.emit({
      event: 'ORDER_CONFIRMED',
      userId,
      title: 'Order confirmed',
      body: `Order ${orderNumber} is confirmed.`,
      channels: ['IN_APP', 'EMAIL'],
    })
  }
  reservationConfirmed(userId: string, code: string) {
    return this.emit({
      event: 'RESERVATION_CONFIRMED',
      userId,
      title: 'Reservation confirmed',
      body: `Your item is booked. Pickup code ${code}.`,
      channels: ['IN_APP', 'SMS'],
    })
  }
  reservationReady(userId: string, code: string) {
    return this.emit({
      event: 'RESERVATION_READY',
      userId,
      title: 'Ready for pickup',
      body: `Show this QR code at the store. Code ${code}.`,
      channels: ['IN_APP', 'SMS'],
    })
  }
  reservationExpiring(userId: string, code: string) {
    return this.emit({
      event: 'RESERVATION_EXPIRING',
      userId,
      title: 'Reservation expiring',
      body: `Reservation ${code} expires soon.`,
      channels: ['IN_APP'],
    })
  }
  sellerOrderReceived(sellerUserId: string, orderNumber: string) {
    return this.emit({
      event: 'SELLER_ORDER_RECEIVED',
      userId: sellerUserId,
      title: 'New order received',
      body: `Order ${orderNumber} needs your confirmation.`,
      channels: ['IN_APP', 'PUSH'],
    })
  }
  driverAssigned(userId: string) {
    return this.emit({
      event: 'DRIVER_ASSIGNED',
      userId,
      title: 'Driver assigned',
      body: 'Your delivery partner is on the way to the store.',
      channels: ['IN_APP'],
    })
  }
  outForDelivery(userId: string) {
    return this.emit({
      event: 'OUT_FOR_DELIVERY',
      userId,
      title: 'Out for delivery',
      body: 'Your order is on the way.',
      channels: ['IN_APP', 'PUSH'],
    })
  }
  delivered(userId: string) {
    return this.emit({
      event: 'DELIVERED',
      userId,
      title: 'Delivered',
      body: 'Your order was delivered. Enjoy!',
      channels: ['IN_APP', 'EMAIL'],
    })
  }
  lowStock(sellerUserId: string, productName: string) {
    return this.emit({
      event: 'LOW_STOCK',
      userId: sellerUserId,
      title: 'Low stock alert',
      body: `${productName} is running low.`,
      channels: ['IN_APP'],
    })
  }
  priceDrop(userId: string, productName: string) {
    return this.emit({
      event: 'PRICE_DROP',
      userId,
      title: 'Price dropped',
      body: `${productName} is cheaper near you now.`,
      channels: ['IN_APP', 'EMAIL'],
    })
  }
}
