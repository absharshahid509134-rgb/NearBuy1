import { CUSTOMER_LOCATION } from '../data/catalog'
import { liveCatalog } from './liveCatalog'
import type {
  AvailabilityConfidence,
  Listing,
  Product,
  Store,
} from '../data/types'

/** Haversine distance in km. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function storeDistance(store: Store): number {
  return distanceKm(CUSTOMER_LOCATION, store)
}

export function getStore(id: string): Store {
  return liveCatalog().stores.find((s) => s.id === id)!
}

export function getProduct(id: string): Product {
  return liveCatalog().products.find((p) => p.id === id)!
}

export function listingsForProduct(productId: string): (Listing & { store: Store; distance: number })[] {
  return liveCatalog().listings.filter((l) => l.productId === productId)
    .map((l) => {
      const store = getStore(l.storeId)
      return { ...l, store, distance: storeDistance(store) }
    })
    .sort((a, b) => a.distance - b.distance)
}

export function listingsForStore(storeId: string): (Listing & { product: Product })[] {
  return liveCatalog().listings.filter((l) => l.storeId === storeId).map((l) => ({
    ...l,
    product: getProduct(l.productId),
  }))
}

export function availabilityConfidence(updatedMinsAgo: number): {
  key: AvailabilityConfidence
  label: string
  hint: string
  className: string
} {
  if (updatedMinsAgo <= 60)
    return {
      key: 'fresh',
      label: 'Confirmed recently',
      hint: `Updated ${updatedMinsAgo} min ago`,
      className: 'text-success-600 bg-success-50',
    }
  if (updatedMinsAgo <= 480)
    return {
      key: 'stale',
      label: 'Updated earlier',
      hint: `Updated ${Math.floor(updatedMinsAgo / 60)} hours ago`,
      className: 'text-warning-700 bg-warning-50',
    }
  return {
    key: 'unknown',
    label: 'Availability needs confirmation',
    hint: 'Store inventory was updated ' + Math.floor(updatedMinsAgo / 60) + ' hours ago',
    className: 'text-neutral-500 bg-neutral-100',
  }
}

export function bestLocalPrice(productId: string): (Listing & { store: Store; distance: number }) | null {
  const all = listingsForProduct(productId).filter((l) => l.stock > 0)
  if (!all.length) return null
  return all.reduce((a, b) => (b.price < a.price ? b : a))
}

export function closestListing(productId: string): (Listing & { store: Store; distance: number }) | null {
  const all = listingsForProduct(productId).filter((l) => l.stock > 0)
  return all.length ? all[0] : null
}

export function fastestPickupMins(productId: string): number | null {
  const all = listingsForProduct(productId).filter((l) => l.stock > 0 && l.store.open && l.store.pickup)
  if (!all.length) return null
  return Math.min(...all.map((l) => l.store.prepMins + l.distance * 6)) // prep + ~6 min/km walk/drive
}

export interface FoundNearbySummary {
  stores: number
  units: number
  closestKm: number | null
  fastestMins: number | null
}

export function foundNearby(productId: string): FoundNearbySummary {
  const all = listingsForProduct(productId).filter((l) => l.stock > 0)
  return {
    stores: all.length,
    units: all.reduce((s, l) => s + l.stock, 0),
    closestKm: all.length ? all[0].distance : null,
    fastestMins: fastestPickupMins(productId),
  }
}

export type SortKey = 'cheapest' | 'fastest' | 'nearest' | 'pickup'

export interface CompareRow {
  kind: 'online' | 'store'
  label: string
  price: number
  distance: number | null
  timeLabel: string
  storeId?: string
  pickup: boolean
  stock?: number
}

export function compareOptions(productId: string): CompareRow[] {
  const p = getProduct(productId)
  const rows: CompareRow[] = []
  if (p.online) {
    rows.push({
      kind: 'online',
      label: 'Online',
      price: p.online.price,
      distance: null,
      timeLabel: `${p.online.etaDaysMin}–${p.online.etaDaysMax} days`,
      pickup: false,
    })
  }
  for (const l of listingsForProduct(productId)) {
    if (l.stock <= 0) continue
    rows.push({
      kind: 'store',
      label: l.store.name,
      price: l.price,
      distance: l.distance,
      timeLabel: l.store.pickup ? `Pickup in ${l.store.prepMins} min` : `${35 + Math.round(l.distance * 8)} min`,
      storeId: l.store.id,
      pickup: l.store.pickup,
      stock: l.stock,
    })
  }
  return sortCompare(rows, 'cheapest')
}

export function sortCompare(rows: CompareRow[], key: SortKey): CompareRow[] {
  const copy = [...rows]
  switch (key) {
    case 'cheapest':
      return copy.sort((a, b) => a.price - b.price)
    case 'nearest':
      return copy.sort(
        (a, b) => (a.distance ?? 99) - (b.distance ?? 99),
      )
    case 'pickup':
      return copy
        .filter((r) => r.pickup)
        .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
    case 'fastest':
      return copy.sort((a, b) => {
        const t = (r: CompareRow) =>
          r.kind === 'online'
            ? (getProduct(rows.find((x) => x.kind === 'online') ? productIdOf(r) : '')?.online?.etaDaysMin ?? 5) * 24 * 60
            : r.pickup
              ? 10 + (r.distance ?? 2) * 6
              : 35 + (r.distance ?? 2) * 8
        return t(a) - t(b)
      })
  }
}

// helper kept tiny — fastest sort needs a stable time estimate per row
function productIdOf(_row: CompareRow): string {
  return ''
}

export function fastestSort(rows: CompareRow[], onlineEtaDaysMin: number): CompareRow[] {
  const minutes = (r: CompareRow) =>
    r.kind === 'online'
      ? onlineEtaDaysMin * 24 * 60
      : r.pickup
        ? 10 + (r.distance ?? 2) * 6
        : 35 + (r.distance ?? 2) * 8
  return [...rows].sort((a, b) => minutes(a) - minutes(b))
}
