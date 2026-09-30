import type { FulfillmentMethod, FulfillmentOption } from '@nearbuy/types'
import type { MapProvider } from '@nearbuy/maps'
/**
 * Fulfillment engine — reusable abstraction over fulfillment methods.
 * UI never hard-codes fulfillment logic; all availability/fees/ETAs come from here.
 */

export interface FulfillmentContext {
  store?: {
    id: string
    name: string
    pickupEnabled: boolean
    localDelivery: boolean
    localDeliveryKm: number
    prepMins: number
    open: boolean
  } | null
  online: { price: number; etaMin: number; etaMax: number } | null
  inStockLocal: number
  distanceKm: number
  hasLocalListing: boolean
}

export const FEE = {
  standard: 40,
  fast: 80,
  local: 30,
  pickup: 0,
  reserve: 0,
} as const

export function buildFulfillmentOptions(ctx: FulfillmentContext, maps: MapProvider): FulfillmentOption[] {
  const s = ctx.store
  const driveMins = maps.estimateTravelMins({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }, 'drive') && ctx.hasLocalListing
    ? Math.round(8 + ctx.distanceKm * 6)
    : 45

  const options: FulfillmentOption[] = [
    {
      method: 'STANDARD_DELIVERY' as FulfillmentMethod,
      label: 'Standard Delivery',
      estimatedTime: ctx.online ? `${ctx.online.etaMin}–${ctx.online.etaMax} days` : 'Not available online',
      fee: FEE.standard,
      available: !!ctx.online,
      sellerEligible: false,
      reason: ctx.online ? undefined : 'No online listing',
    },
    {
      method: 'FAST_DELIVERY' as FulfillmentMethod,
      label: 'Fast Delivery',
      estimatedTime: ctx.online ? '1–2 days' : 'Not available online',
      fee: FEE.fast,
      available: !!ctx.online,
      sellerEligible: false,
    },
    {
      method: 'NEARBY_PICKUP' as FulfillmentMethod,
      label: 'Nearby Pickup',
      estimatedTime: s ? `${s.prepMins} min prep · ${ctx.distanceKm} km` : 'No nearby store',
      fee: FEE.pickup,
      available: !!s && s.pickupEnabled && s.open && ctx.inStockLocal > 0,
      sellerEligible: true,
      serviceAreaKm: undefined,
      storeId: s?.id,
      reason: !s ? 'No nearby store' : !s.open ? 'Store closed' : ctx.inStockLocal <= 0 ? 'Out of stock' : undefined,
    },
    {
      method: 'LOCAL_DELIVERY' as FulfillmentMethod,
      label: 'Local Delivery',
      estimatedTime: s ? `${driveMins} min from ${s.name}` : 'Not deliverable',
      fee: FEE.local,
      available: !!s && s.localDelivery && ctx.distanceKm <= s.localDeliveryKm && ctx.inStockLocal > 0,
      sellerEligible: true,
      serviceAreaKm: s?.localDeliveryKm,
      storeId: s?.id,
    },
    {
      method: 'RESERVE_AND_PICKUP' as FulfillmentMethod,
      label: 'Reserve & Pickup',
      estimatedTime: 'Book now · Collect today',
      fee: FEE.reserve,
      available: !!s && s.pickupEnabled && ctx.inStockLocal > 0,
      sellerEligible: true,
      storeId: s?.id,
    },
  ]
  return options
}

export function feeFor(method: FulfillmentMethod): number {
  switch (method) {
    case 'STANDARD_DELIVERY':
      return FEE.standard
    case 'FAST_DELIVERY':
      return FEE.fast
    case 'LOCAL_DELIVERY':
      return FEE.local
    default:
      return FEE.reserve
  }
}

export function etaMinsFor(method: FulfillmentMethod, distanceKm: number, prepMins = 12): number | undefined {
  switch (method) {
    case 'LOCAL_DELIVERY':
      return Math.round(prepMins + 20 + distanceKm * 6)
    case 'NEARBY_PICKUP':
    case 'RESERVE_AND_PICKUP':
      return prepMins
    default:
      return undefined
  }
}
