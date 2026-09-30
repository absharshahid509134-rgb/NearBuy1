import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'

export interface SellerStore {
  id: string
  name: string
  area: string
  address?: string
  hours?: string
  verified: boolean
  open: boolean
}
export interface SellerProfile {
  id: string
  legalName: string
  verified: boolean
  stores: SellerStore[]
}
export interface SellerOrder {
  id: string
  number: string
  status: string
  total: number | string
  createdAt: string
  storeId: string | null
  fulfillmentMethod?: string
  delivery?: { status: string; pickupCode?: string } | null
  items: { name: string; qty: number; unitPrice: number | string }[]
  user?: { name: string; phone?: string | null }
}
export interface SellerReservation {
  id: string
  code: string
  status: string
  createdAt: string
  pickupWindow: string
  storeId: string
  items: { qty: number; product?: { name: string; emoji: string } }[]
}
export interface SellerStockRequest {
  id: string
  storeId: string
  productId: string
  qty: number
  status: string
  createdAt: string
  product?: { name: string }
}
export interface SellerInventoryItem {
  id: string
  productId: string
  name: string
  brand?: string
  emoji: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  price: number
  status: string
  confidence: string
  updatedMinsAgo: number
}

interface SellerState {
  profile: SellerProfile | null
  orders: SellerOrder[]
  reservations: SellerReservation[]
  inventory: SellerInventoryItem[]
  stockRequests: SellerStockRequest[]
  loading: boolean
  needsOnboarding: boolean
  error: string | null
  refresh: () => Promise<void>
  orderAction: (id: string, action: string) => Promise<void>
  reservationAction: (id: string, action: string, code?: string) => Promise<void>
  updateStock: (item: SellerInventoryItem, quantity: number) => Promise<void>
  setStoreOpen: (storeId: string, open: boolean) => Promise<void>
  respondToStockCheck: (id: string, available: boolean) => Promise<void>
}
const SellerContext = createContext<SellerState | null>(null)

export function SellerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [reservations, setReservations] = useState<SellerReservation[]>([])
  const [inventory, setInventory] = useState<SellerInventoryItem[]>([])
  const [stockRequests, setStockRequests] = useState<SellerStockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const seller = await api.get<SellerProfile>('/sellers/me')
      setProfile(seller)
      setNeedsOnboarding(false)
      const [newOrders, newReservations, newInventory, newChecks] = await Promise.all([
        api.get<SellerOrder[]>('/orders?role=seller'),
        api.get<SellerReservation[]>('/reservations?role=seller'),
        api.get<SellerInventoryItem[]>('/inventory'),
        api.get<SellerStockRequest[]>('/inventory/confirm-requests'),
      ])
      setOrders(newOrders)
      setReservations(newReservations)
      setInventory(newInventory)
      setStockRequests(newChecks)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setNeedsOnboarding(true)
        setProfile(null)
      } else setError(cause instanceof Error ? cause.message : 'Could not load your store.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void refresh()
    const onReturn = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onReturn)
    return () => document.removeEventListener('visibilitychange', onReturn)
  }, [user?.id])

  const value = useMemo<SellerState>(
    () => ({
      profile,
      orders,
      reservations,
      inventory,
      stockRequests,
      loading,
      needsOnboarding,
      error,
      refresh,
      orderAction: async (id, action) => {
        await api.post(`/orders/${encodeURIComponent(id)}/${encodeURIComponent(action)}`)
        await refresh()
      },
      reservationAction: async (id, action, code) => {
        await api.post(
          `/reservations/${encodeURIComponent(id)}/${encodeURIComponent(action)}`,
          code ? { code } : {},
        )
        await refresh()
      },
      updateStock: async (item, quantity) => {
        await api.post('/inventory/bulk', {
          source: 'MANUAL',
          items: [{ productId: item.productId, quantity, price: Number(item.price), reserveEnabled: true }],
        })
        await refresh()
      },
      setStoreOpen: async (storeId, open) => {
        await api.patch(`/sellers/stores/${encodeURIComponent(storeId)}`, { open })
        await refresh()
      },
      respondToStockCheck: async (id, available) => {
        await api.post(`/inventory/confirm-requests/${encodeURIComponent(id)}/respond`, { available })
        await refresh()
      },
    }),
    [profile, orders, reservations, inventory, stockRequests, loading, needsOnboarding, error],
  )

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>
}

export function useSeller(): SellerState {
  const context = useContext(SellerContext)
  if (!context) throw new Error('useSeller must be inside SellerProvider')
  return context
}
