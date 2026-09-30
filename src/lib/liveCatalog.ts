import { useSyncExternalStore } from 'react'
import type { Category, CategoryId, Listing, Offer, Product, Review, Store } from '../data/types'

/**
 * Live catalog — the single in-memory source of truth for customer
 * discovery data, hydrated from the persisted API (GET /api/v1/catalog).
 *
 * In production the storefront renders ONLY what this registry holds (the
 * database). `src/data/catalog.ts`'s static arrays are a development/preview
 * fallback only; CatalogContext decides which source hydrates this module.
 *
 * Modules that historically read static imports (lib/geo, lib/search,
 * lib/nearai) now read `liveCatalog()` at call time, and components use the
 * reactive `useLiveCatalog()` hook so pages re-render once data arrives.
 */

export interface LiveCatalogData {
  stores: Store[]
  products: Product[]
  listings: Listing[]
  categories: Category[]
  /** store reviews keyed by store id — same shape as the static demo REVIEWS */
  storeReviews: Record<string, Review[]>
  /** product reviews keyed by product id */
  productReviews: Record<string, Review[]>
  offers: Offer[]
  generatedAt: number
  /** true when this snapshot came from the demo (preview-mode) source */
  preview: boolean
}

export type CatalogStatus = 'loading' | 'ready' | 'error'

interface LiveCatalogState extends LiveCatalogData {
  status: CatalogStatus
  error: string | null
}

const EMPTY: LiveCatalogState = {
  stores: [],
  products: [],
  listings: [],
  categories: [],
  storeReviews: {},
  productReviews: {},
  offers: [],
  generatedAt: 0,
  preview: false,
  status: 'loading',
  error: null,
}

let state: LiveCatalogState = EMPTY
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => l())
}

function set(next: Partial<LiveCatalogState> & { status: CatalogStatus }): void {
  state = { ...state, ...next }
  notify()
}

export function loadLiveCatalog(): void {
  set({ status: 'loading', error: null })
}

export function failLiveCatalog(error: string): void {
  set({ status: 'error', error })
}

/** Hydrate the registry from a persisted API payload. */
export function hydrateLiveCatalog(data: Omit<LiveCatalogData, 'offers'>): void {
  set({ ...data, offers: deriveOffers(data), status: 'ready', error: null })
}

export function previewLiveCatalog(data: Omit<LiveCatalogData, 'offers' | 'preview'>): void {
  hydrateLiveCatalog({ ...data, preview: true })
}

export function getLiveCatalogState(): LiveCatalogState {
  return state
}

/** Snapshot accessor for non-React modules (geo/search/nearai). */
export function liveCatalog(): Pick<LiveCatalogState, 'stores' | 'products' | 'listings' | 'categories' | 'storeReviews' | 'productReviews' | 'offers'> {
  return {
    stores: state.stores,
    products: state.products,
    listings: state.listings,
    categories: state.categories,
    storeReviews: state.storeReviews,
    productReviews: state.productReviews,
    offers: state.offers,
  }
}

/** Non-reactive lookup for styling maps (safe outside hooks). */
export function categoryById(id: string): Category | undefined {
  return state.categories.find((c) => c.id === id)
}

/** Reactive hook — components re-render when the catalog hydrates. */
export function useLiveCatalog(): LiveCatalogState & { categoryMap: Record<string, Category> } {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
  return {
    ...snap,
    // keyed by category id (slug) — store.category is normalized to it
    categoryMap: Object.fromEntries(snap.categories.map((c) => [c.id, c])),
  }
}

// ── helpers shared by consumers ────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { tint: string; accent: string }> = {
  Sports: { tint: 'bg-emerald-50', accent: 'text-emerald-700' },
  Electronics: { tint: 'bg-indigo-50', accent: 'text-indigo-700' },
  Stationery: { tint: 'bg-amber-50', accent: 'text-amber-700' },
  Fashion: { tint: 'bg-pink-50', accent: 'text-pink-700' },
  'Home & Living': { tint: 'bg-teal-50', accent: 'text-teal-700' },
  Grocery: { tint: 'bg-lime-50', accent: 'text-lime-700' },
  Handmade: { tint: 'bg-orange-50', accent: 'text-orange-700' },
  Gifts: { tint: 'bg-purple-50', accent: 'text-purple-700' },
}

/** Merge persisted categories with the UI's per-category tint/accent. */
export function withCategoryStyles(categories: Array<{ id: string; name: string; emoji: string; productCount?: number }>): Category[] {
  return categories.map((c) => {
    const style = CATEGORY_STYLES[c.name] ?? { tint: 'bg-neutral-100', accent: 'text-neutral-700' }
    return {
      id: c.id as CategoryId,
      name: c.name,
      emoji: c.emoji,
      productCount: c.productCount,
      tint: style.tint,
      accent: style.accent,
    }
  })
}

/** Deals = local listings that beat the product's online price. */
function deriveOffers(data: { stores: Store[]; products: Product[]; listings: Listing[] }): Offer[] {
  const offers: Offer[] = []
  const byProduct = new Map<string, Listing[]>()
  for (const l of data.listings) {
    if (l.stock <= 0) continue
    const arr = byProduct.get(l.productId) ?? []
    arr.push(l)
    byProduct.set(l.productId, arr)
  }
  for (const p of data.products) {
    const local = byProduct.get(p.id) ?? []
    if (!local.length || !p.online) continue
    const best = local.reduce((a, b) => (b.price < a.price ? b : a))
    const savings = Math.round(p.online.price - best.price)
    if (savings > 0) {
      const store = data.stores.find((s) => s.id === best.storeId)
      offers.push({
        id: `local-${p.id}`,
        title: `${p.name} — cheaper at ${store?.name ?? 'a local store'}`,
        kind: 'cheapest',
        productId: p.id,
        storeId: best.storeId,
        savings,
        detail: `₹${best.price.toLocaleString('en-IN')} locally vs ₹${p.online.price.toLocaleString('en-IN')} online`,
      })
    }
    const openStore = local.find((l) => {
      const s = data.stores.find((x) => x.id === l.storeId)
      return s?.open && s.pickup
    })
    if (openStore) {
      const store = data.stores.find((s) => s.id === openStore.storeId)
      if (store) {
        offers.push({
          id: `pickup-${p.id}`,
          title: `${p.name} — ready for pickup at ${store.name}`,
          kind: 'fast',
          productId: p.id,
          storeId: store.id,
          savings: 0,
          detail: `Pickup in ${store.prepMins} min · ${store.area}`,
        })
      }
    }
  }
  return offers
}
