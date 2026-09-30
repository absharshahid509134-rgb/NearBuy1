/**
 * TanStack Query hooks + zustand session store. All server data (prices,
 * inventory, statuses) flows through here; the UI only renders it.
 */
'use client'
import * as React from 'react'
import { create } from 'zustand'
import {
  useQuery, useMutation, useQueryClient, type UseQueryResult,
} from '@tanstack/react-query'
import { api, ApiError } from './client'
import * as session from './session'
import type {
  AddressView, AdminMetrics, AdminUserRow, AdminSellerRow, AuditLogRow, CartView,
  DemandRadarRow, InventoryRow, LoginResult, MeView, NotificationRow, OrderDetail,
  OrderRow, ProductDetail, ProductRow, QuoteView, ReservationRow, ReturnRequestView,
  SearchResponse, SellerMeView, StoreNearbyRow, CategoryNode, CheckoutItem,
} from './types'

interface SessionState {
  user: MeView | null
  checked: boolean
  token: string | null
  setUser: (u: MeView | null) => void
  setChecked: (c: boolean) => void
  setToken: (t: string | null) => void
}
export const useSession = create<SessionState>((set) => ({
  user: null,
  checked: false,
  token: null,
  setUser: (user) => set({ user }),
  setChecked: (checked) => set({ checked }),
  setToken: (token) => set({ token }),
}))

export async function loadMe(setUser: (u: MeView | null) => void, setChecked: (c: boolean) => void): Promise<void> {
  try {
    setUser(await session.me())
  } catch {
    setUser(null)
  } finally {
    setChecked(true)
  }
}

function rememberLogin(result: LoginResult, s: SessionState): void {
  s.setToken(result.accessToken)
  s.setUser(result.user)
  s.setChecked(true)
}

export function useLogin() {
  const s = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { email: string; password: string }) => session.login(b.email, b.password),
    onSuccess: (r) => {
      rememberLogin(r, s)
      void qc.invalidateQueries()
    },
  })
}

export function useRegister() {
  const s = useSession()
  return useMutation({
    mutationFn: (input: session.RegisterInput) => session.register(input),
    onSuccess: (r) => rememberLogin(r, s),
  })
}

export function useVerifyOtp() {
  const s = useSession()
  return useMutation({
    mutationFn: (b: { userId: string; code: string }) => session.verifyOtp(b.userId, b.code),
    onSuccess: (r) => rememberLogin(r, s),
  })
}

export function useLogout() {
  const s = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => session.logout().catch(() => undefined),
    onSuccess: () => {
      s.setUser(null)
      s.setToken(null)
      qc.clear()
    },
  })
}

// ── Search & catalog ────────────────────────────────────────────────────────
export interface SearchParams {
  q?: string
  sort?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  radiusKm?: number
  openNow?: boolean
  pickupToday?: boolean
  fast?: boolean
  take?: number
}
export function useSearch(p: SearchParams): UseQueryResult<SearchResponse, ApiError> {
  const qs = new URLSearchParams()
  if (p.q) qs.set('query', p.q)
  if (p.sort) qs.set('sort', p.sort)
  if (p.category) qs.set('category', p.category)
  if (p.minPrice !== undefined) qs.set('minPrice', String(p.minPrice))
  if (p.maxPrice !== undefined) qs.set('maxPrice', String(p.maxPrice))
  qs.set('lat', '28.5921'); qs.set('lng', '77.046')
  if (p.radiusKm) qs.set('radiusKm', String(p.radiusKm))
  if (p.openNow) qs.set('openNow', '1')
  if (p.pickupToday) qs.set('pickupToday', '1')
  if (p.fast) qs.set('fast', '1')
  qs.set('take', String(p.take ?? 24))
  return useQuery({ queryKey: ['search', p], queryFn: () => api.get<SearchResponse>(`/search?${qs}`) })
}

export function useProduct(slug: string): UseQueryResult<ProductDetail, ApiError> {
  return useQuery({ queryKey: ['product', slug], queryFn: () => api.get<ProductDetail>(`/products/${slug}`) })
}

export function useProducts(take = 24): UseQueryResult<ProductRow[], ApiError> {
  return useQuery({ queryKey: ['products', take], queryFn: () => api.get<ProductRow[]>(`/products?take=${take}`) })
}

export function useCategories(): UseQueryResult<CategoryNode[], ApiError> {
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get<CategoryNode[]>('/categories') })
}

export function useStoreProducts(slug: string): UseQueryResult<ProductRow[], ApiError> {
  return useQuery({ queryKey: ['store-products', slug], queryFn: () => api.get<ProductRow[]>(`/stores/${slug}/products`) })
}

export function useNearbyStores(take = 12): UseQueryResult<StoreNearbyRow[], ApiError> {
  return useQuery({
    queryKey: ['stores-nearby', take],
    queryFn: () => api.get<StoreNearbyRow[]>(`/stores/nearby?lat=28.5921&lng=77.046&take=${take}`),
  })
}

export function useFulfillment(productId: string, qty = 1, storeId?: string): UseQueryResult<{ options: import('./types').FulfillmentOption[] }, ApiError> {
  const qs = new URLSearchParams({ productId, qty: String(qty), lat: '28.5921', lng: '77.046' })
  if (storeId) qs.set('storeId', storeId)
  return useQuery({
    queryKey: ['fulfillment', productId, qty, storeId],
    queryFn: () => api.get<{ options: import('./types').FulfillmentOption[] }>(`/fulfillment/methods?${qs}`),
    enabled: Boolean(productId),
  })
}

// ── Cart ────────────────────────────────────────────────────────────────────
export function useCart(): UseQueryResult<CartView, ApiError> {
  return useQuery({ queryKey: ['cart'], queryFn: () => api.get<CartView>('/cart') })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { productId: string; qty: number; variantId?: string; storeId?: string }) => api.post('/cart/items', b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cart'] }),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { id: string; qty: number }) => api.patch(`/cart/items/${b.id}`, { qty: b.qty }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cart'] }),
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/cart/items/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cart'] }),
  })
}

export function useQuote() {
  return useMutation({
    mutationFn: (b: { items: CheckoutItem[]; fulfillment: string; paymentMethod: string; addressId?: string; couponCode?: string }) =>
      api.post<QuoteView>('/checkout/quote', b),
  })
}

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { items: CheckoutItem[]; fulfillment: string; paymentMethod: string; addressId?: string; couponCode?: string }) =>
      api.post<{ orders: OrderDetail[] }>('/checkout/orders', b),
    onSuccess: () => void qc.invalidateQueries(),
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { items: CheckoutItem[]; pickupWindow: string }) => api.post<ReservationRow>('/checkout/reservations', b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

// ── Orders / Reservations ───────────────────────────────────────────────────
export function useOrders(role?: 'seller'): UseQueryResult<OrderRow[], ApiError> {
  return useQuery({ queryKey: ['orders', role], queryFn: () => api.get<OrderRow[]>(`/orders?take=50${role ? `&role=${role}` : ''}`) })
}

export function useOrder(id: string): UseQueryResult<OrderDetail, ApiError> {
  return useQuery({ queryKey: ['order', id], queryFn: () => api.get<OrderDetail>(`/orders/${id}`), enabled: Boolean(id) })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/cancel`),
    onSuccess: (_d, id) => void qc.invalidateQueries({ queryKey: ['order', id] }),
  })
}

export function useOrderAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { id: string; action: string }) => api.post(`/orders/${b.id}/${b.action}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useReservations(role?: 'seller'): UseQueryResult<ReservationRow[], ApiError> {
  return useQuery({
    queryKey: ['reservations', role],
    queryFn: () => api.get<ReservationRow[]>(`/reservations?take=50${role ? `&role=${role}` : ''}`),
  })
}

export function useReservation(id: string): UseQueryResult<ReservationRow, ApiError> {
  return useQuery({ queryKey: ['reservation', id], queryFn: () => api.get<ReservationRow>(`/reservations/${id}`), enabled: Boolean(id) })
}

export function useReservationAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { id: string; action: string }) => api.post(`/reservations/${b.id}/${b.action}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

// ── Addresses / Wishlist / Notifications ────────────────────────────────────
export function useAddresses(): UseQueryResult<AddressView[], ApiError> {
  return useQuery({ queryKey: ['addresses'], queryFn: () => api.get<AddressView[]>('/users/me/addresses') })
}

export function useAddAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: Omit<AddressView, 'id'>) => api.post<AddressView>('/users/me/addresses', b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/users/me/addresses/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useWishlist(): UseQueryResult<{ items: Array<{ id: string; productId: string; createdAt: string }> }, ApiError> {
  return useQuery({ queryKey: ['wishlist'], queryFn: () => api.get('/wishlist') })
}

export function useToggleWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { productId: string; on: boolean }) =>
      b.on ? api.post('/wishlist/items', { productId: b.productId }) : api.del(`/wishlist/items/${b.productId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })
}

export function useNotifications(): UseQueryResult<{ items: NotificationRow[] } | NotificationRow[], ApiError> {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications') })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read', {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// ── Returns (compact ReturnsModule) ─────────────────────────────────────────
export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { orderId: string; items: Array<{ productId: string; qty: number; reason: string }>; resolution: string }) =>
      api.post<ReturnRequestView>('/returns', b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['returns'] }),
  })
}

export function useReturns(role?: 'seller'): UseQueryResult<ReturnRequestView[], ApiError> {
  return useQuery({
    queryKey: ['returns', role],
    queryFn: () => api.get<ReturnRequestView[]>(`/returns?take=50${role ? `&role=${role}` : ''}`),
  })
}

export function useReturnAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { id: string; action: string; note?: string }) => api.post(`/returns/${b.id}/${b.action}`, { note: b.note }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['returns'] }),
  })
}

// ── Seller / Admin ──────────────────────────────────────────────────────────
export function useSellerMe(): UseQueryResult<SellerMeView, ApiError> {
  return useQuery({ queryKey: ['seller-me'], queryFn: () => api.get<SellerMeView>('/sellers/me') })
}

export function useAdminMetrics(): UseQueryResult<AdminMetrics, ApiError> {
  return useQuery({ queryKey: ['admin-metrics'], queryFn: () => api.get<AdminMetrics>('/admin/metrics') })
}

export function useAdminUsers(): UseQueryResult<AdminUserRow[], ApiError> {
  return useQuery({ queryKey: ['admin-users'], queryFn: () => api.get<AdminUserRow[]>('/admin/users') })
}

export function useAdminSellers(): UseQueryResult<AdminSellerRow[], ApiError> {
  return useQuery({ queryKey: ['admin-sellers'], queryFn: () => api.get<AdminSellerRow[]>('/admin/sellers') })
}

export function useAdminAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { path: string; body?: unknown }) => api.post(b.path, b.body ?? {}),
    onSuccess: () => void qc.invalidateQueries(),
  })
}

export function useAuditLogs(): UseQueryResult<AuditLogRow[], ApiError> {
  return useQuery({ queryKey: ['audit'], queryFn: () => api.get<AuditLogRow[]>('/admin/audit-logs') })
}

export function useDemandRadar(): UseQueryResult<DemandRadarRow[], ApiError> {
  return useQuery({ queryKey: ['demand-radar'], queryFn: () => api.get<DemandRadarRow[]>('/admin/demand-radar') })
}

export function useInventory(): UseQueryResult<InventoryRow[], ApiError> {
  return useQuery({ queryKey: ['inventory'], queryFn: () => api.get<InventoryRow[]>('/inventory') })
}

export function useNearAI() {
  return useMutation({
    mutationFn: (b: { message: string }) => api.post<{ reply: string }>('/ai/nearai', b),
  })
}

export { ApiError }
export type { OrderRow, OrderDetail, ReservationRow, ReturnRequestView }
