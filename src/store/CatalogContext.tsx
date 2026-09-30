import { useCallback, useEffect, type ReactNode } from 'react'
import { apiRequest } from '../auth/api'
import {
  failLiveCatalog,
  hydrateLiveCatalog,
  loadLiveCatalog,
  previewLiveCatalog,
  useLiveCatalog,
  withCategoryStyles,
  type LiveCatalogData,
} from '../lib/liveCatalog'
import { CATEGORIES, LISTINGS, PRODUCTS, REVIEWS, STORES } from '../data/catalog'
import type { Product, Store } from '../data/types'

/**
 * CatalogProvider — fetches the persisted catalog from the API and hydrates
 * the live catalog registry. Production: database only, never a static
 * fallback. Preview mode (Vite dev middleware): the demo API's catalog route
 * is used, and if it is unreachable the static demo arrays hydrate the
 * registry so the prototype keeps working offline.
 */

interface CatalogPayload {
  generatedAt: string
  categories: Array<{ id: string; name: string; emoji: string; productCount: number }>
  stores: Store[]
  products: Product[]
  listings: Array<{
    productId: string
    storeId: string
    price: number
    stock: number
    quantity?: number
    status?: string
    reserveable: boolean
    updatedMinsAgo: number
  }>
  reviews: {
    store: Array<{ id: string; storeId: string; author: string; rating: number; text: string; when: string }>
    product: Array<{ id: string; productId: string; author: string; rating: number; text: string; when: string }>
  }
}

function mapReviews(
  rows: Array<{ id: string; author: string; rating: number; text: string; when: string; storeId?: string; productId?: string }>,
  key: 'storeId' | 'productId',
): Record<string, Array<{ id: string; storeId: string; author: string; rating: number; text: string; when: string }>> {
  const out: Record<string, Array<{ id: string; storeId: string; author: string; rating: number; text: string; when: string }>> = {}
  for (const r of rows) {
    const k = r[key]
    if (!k) continue
    const entry = { id: r.id, storeId: key === 'storeId' ? (r.storeId as string) : '', author: r.author, rating: r.rating, text: r.text, when: r.when }
    out[k] = out[k] ?? []
    out[k].push(entry)
  }
  return out
}

function mapPayload(payload: CatalogPayload): Omit<LiveCatalogData, 'offers'> {
  // Persisted stores carry the category name; the UI filters by category id
  // (slug). Normalize so `store.category === category.id` keeps working.
  const byName = new Map(payload.categories.map((c) => [c.name.toLowerCase(), c.id]))
  const stores = payload.stores.map((s) => ({
    ...s,
    category: (byName.get(s.category.toLowerCase()) ?? s.category.toLowerCase()) as Store['category'],
  }))
  return {
    stores,
    products: payload.products,
    listings: payload.listings.map((l) => ({
      productId: l.productId,
      storeId: l.storeId,
      price: l.price,
      stock: l.stock,
      updatedMinsAgo: l.updatedMinsAgo,
      reserveable: l.reserveable,
    })),
    categories: withCategoryStyles(payload.categories),
    storeReviews: mapReviews(payload.reviews.store, 'storeId'),
    productReviews: mapReviews(payload.reviews.product, 'productId'),
    generatedAt: new Date(payload.generatedAt).getTime(),
    preview: false,
  }
}

function previewData(): Omit<LiveCatalogData, 'offers' | 'preview'> {
  const storeReviews: Record<string, Array<{ id: string; storeId: string; author: string; rating: number; text: string; when: string }>> = {}
  for (const r of REVIEWS) {
    storeReviews[r.storeId] = storeReviews[r.storeId] ?? []
    storeReviews[r.storeId].push(r)
  }
  return {
    stores: STORES,
    products: PRODUCTS,
    listings: LISTINGS,
    categories: withCategoryStyles(CATEGORIES),
    storeReviews,
    productReviews: {},
    generatedAt: Date.now(),
  }
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const load = useCallback(async () => {
    loadLiveCatalog()
    try {
      const payload = await apiRequest<CatalogPayload>('/catalog')
      hydrateLiveCatalog(mapPayload(payload))
    } catch (e) {
      if (__NEARBUY_PREVIEW__) {
        // Dev preview: keep the prototype usable when the demo API lacks the
        // route or the API is down — clearly marked as preview data.
        previewLiveCatalog(previewData())
      } else {
        // Production: never fall back to static data. Surface the error and
        // let the user retry.
        failLiveCatalog(e instanceof Error ? e.message : 'Could not load the store catalog.')
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return <CatalogContextView onReload={() => void load()}>{children}</CatalogContextView>
}

function CatalogContextView({ onReload, children }: { onReload: () => void; children: ReactNode }) {
  const { status, error } = useLiveCatalog()
  if (status === 'error' && !__NEARBUY_PREVIEW__) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f9fc] px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4" aria-hidden>🛒</div>
          <h1 className="text-xl font-bold text-neutral-900">We couldn’t load the market</h1>
          <p className="text-sm text-neutral-600 mt-2">{error ?? 'Something went wrong while loading stores and products.'}</p>
          <button
            type="button"
            onClick={onReload}
            className="mt-5 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

export function useCatalog(): ReturnType<typeof useLiveCatalog> {
  return useLiveCatalog()
}

/** Gate for catalog-dependent page bodies: spinner until the persisted
 * catalog has hydrated, then the real content. */
export function CatalogGate({ children }: { children: ReactNode }) {
  const { status } = useLiveCatalog()
  if (status !== 'ready') {
    return (
      <div className="nb-container py-16 grid place-items-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-brand-600 rounded-full animate-spin" />
          Loading the market…
        </div>
      </div>
    )
  }
  return <>{children}</>
}
