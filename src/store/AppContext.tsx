import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SEED_ORDERS, SEED_RESERVATIONS, SEED_WISHLIST } from '../data/catalog'
import type { Order, Reservation } from '../data/types'
import { api } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { orderFromApi, reservationFromApi, type ApiOrder, type ApiReservation } from './serverCommerce'

export interface CartLine {
  productId: string
  storeId: string
  qty: number
  price: number
}

export interface Toast {
  id: number
  title: string
  body?: string
  kind: 'success' | 'info' | 'warning' | 'error'
}

interface AppState {
  cart: CartLine[]
  addToCart: (line: CartLine) => void
  setQty: (productId: string, storeId: string, qty: number) => void
  removeFromCart: (productId: string, storeId: string) => void
  clearCart: () => void
  cartCount: number
  cartTotal: number

  wishlist: string[]
  toggleWishlist: (productId: string) => void

  orders: Order[]
  placeOrder: (o: Order) => void
  reservations: Reservation[]
  placeReservation: (r: Reservation) => void
  updateReservation: (id: string, patch: Partial<Reservation>) => void
  refreshCommerce: () => Promise<void>
  commerceError: string | null

  followed: string[]
  toggleFollow: (storeId: string) => void

  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void

  recentSearches: string[]
  pushSearch: (q: string) => void

  liveChecks: Record<string, 'pending' | 'available' | 'unavailable'> // storeId:productId → server reply
  requestLiveCheck: (productId: string, storeId: string) => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

// The illustrative storefront keeps browsing preferences and seeded examples
// account-scoped. New preview orders/reservations are server-owned and are
// reconciled on return, so switching accounts never reveals another buyer's data.
function load<T>(namespace: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`nearbuy:${namespace}:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(namespace: string, key: string, value: unknown) {
  try {
    localStorage.setItem(`nearbuy:${namespace}:${key}`, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

let toastId = 1

export function AppProvider({ children, namespace }: { children: React.ReactNode; namespace: string }) {
  const { user } = useAuth()
  const isBuyer = user?.role === 'CUSTOMER' && user.id === namespace
  const seed = __NEARBUY_PREVIEW__ && namespace === 'demo-customer'
  const [cart, setCart] = useState<CartLine[]>(() => load(namespace, 'cart', [] as CartLine[]))
  const [wishlist, setWishlist] = useState<string[]>(() => load(namespace, 'wishlist', seed ? SEED_WISHLIST : []))
  const [orders, setOrders] = useState<Order[]>(() => load(namespace, 'orders', seed ? SEED_ORDERS : []))
  const [reservations, setReservations] = useState<Reservation[]>(() =>
    load(namespace, 'reservations', seed ? SEED_RESERVATIONS : []),
  )
  const [followed, setFollowed] = useState<string[]>(() => load(namespace, 'followed', seed ? ['s1', 's6'] : []))
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    load(namespace, 'searches', seed ? ['volleyball under ₹1500', 'printer ink nearby'] : []),
  )
  const [liveChecks, setLiveChecks] = useState<Record<string, 'pending' | 'available' | 'unavailable'>>(() => load(namespace, 'livechecks', {}))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [commerceError, setCommerceError] = useState<string | null>(null)

  useEffect(() => save(namespace, 'cart', cart), [namespace, cart])
  useEffect(() => save(namespace, 'wishlist', wishlist), [namespace, wishlist])
  useEffect(() => save(namespace, 'orders', orders), [namespace, orders])
  useEffect(() => save(namespace, 'reservations', reservations), [namespace, reservations])
  useEffect(() => save(namespace, 'followed', followed), [namespace, followed])
  useEffect(() => save(namespace, 'searches', recentSearches), [namespace, recentSearches])
  useEffect(() => save(namespace, 'livechecks', liveChecks), [namespace, liveChecks])

  // Server-owned commerce state is reconciled for real sessions too —
  // production buyers see their actual orders/reservations/stock-checks.
  const refreshCommerce = useCallback(async () => {
    if (!isBuyer) return
    try {
      const [newOrders, newReservations, checks] = await Promise.all([
        api.get<ApiOrder[]>('/orders'),
        api.get<ApiReservation[]>('/reservations'),
        api.get<{ storeId: string; productId: string; status: string }[]>('/stock-requests/mine'),
      ])
      const serverOrders = newOrders.map(orderFromApi)
      const serverReservations = newReservations.map(reservationFromApi)
      setOrders((prev) => [...serverOrders, ...prev.filter((o) => !o.serverId)])
      setReservations((prev) => [...serverReservations, ...prev.filter((r) => !r.serverId)])
      const statuses: Record<string, 'pending' | 'available' | 'unavailable'> = {}
      for (const item of [...checks].reverse()) {
        statuses[`${item.storeId}:${item.productId}`] = item.status === 'AVAILABLE' ? 'available' : item.status === 'NOT_AVAILABLE' ? 'unavailable' : 'pending'
      }
      setLiveChecks(statuses)
      setCommerceError(null)
    } catch (cause) {
      setCommerceError(cause instanceof Error ? cause.message : 'Could not refresh your orders.')
    }
  }, [isBuyer])
  useEffect(() => {
    if (!isBuyer) return
    void refreshCommerce()
    const onReturn = () => { if (document.visibilityState === 'visible') void refreshCommerce() }
    document.addEventListener('visibilitychange', onReturn)
    return () => document.removeEventListener('visibilitychange', onReturn)
  }, [refreshCommerce, isBuyer])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = toastId++
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200)
  }, [])

  const addToCart = useCallback(
    (line: CartLine) => {
      setCart((prev) => {
        const i = prev.findIndex(
          (l) => l.productId === line.productId && l.storeId === line.storeId,
        )
        if (i >= 0) {
          const copy = [...prev]
          copy[i] = { ...copy[i], qty: copy[i].qty + line.qty }
          return copy
        }
        return [...prev, line]
      })
    },
    [],
  )

  const value = useMemo<AppState>(
    () => ({
      cart,
      addToCart,
      setQty: (productId, storeId, qty) =>
        setCart((prev) =>
          qty <= 0
            ? prev.filter((l) => !(l.productId === productId && l.storeId === storeId))
            : prev.map((l) =>
                l.productId === productId && l.storeId === storeId ? { ...l, qty } : l,
              ),
        ),
      removeFromCart: (productId, storeId) =>
        setCart((prev) =>
          prev.filter((l) => !(l.productId === productId && l.storeId === storeId)),
        ),
      clearCart: () => setCart([]),
      cartCount: cart.reduce((s, l) => s + l.qty, 0),
      cartTotal: cart.reduce((s, l) => s + l.qty * l.price, 0),

      wishlist,
      toggleWishlist: (productId) =>
        setWishlist((prev) =>
          prev.includes(productId) ? prev.filter((p) => p !== productId) : [...prev, productId],
        ),

      orders,
      placeOrder: (o) => setOrders((prev) => [o, ...prev]),
      reservations,
      placeReservation: (r) => setReservations((prev) => [r, ...prev]),
      updateReservation: (id, patch) =>
        setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
      refreshCommerce,
      commerceError,

      followed,
      toggleFollow: (storeId) =>
        setFollowed((prev) =>
          prev.includes(storeId) ? prev.filter((s) => s !== storeId) : [...prev, storeId],
        ),

      toasts,
      toast,
      dismissToast: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),

      recentSearches,
      pushSearch: (q) =>
        setRecentSearches((prev) => [q, ...prev.filter((s) => s !== q)].slice(0, 6)),

      liveChecks,
      requestLiveCheck: async (productId, storeId) => {
        await api.post('/stock-requests', { productId, storeId, qty: 1 })
        setLiveChecks((prev) => ({ ...prev, [`${storeId}:${productId}`]: 'pending' }))
        toast({ kind: 'success', title: 'Shelf check sent', body: 'The store can now respond from its inventory queue.' })
      },
    }),
    [cart, wishlist, orders, reservations, followed, toasts, recentSearches, liveChecks, commerceError, addToCart, toast, refreshCommerce],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
