/* Development-only API for the unified portal preview.
 * Real deployments use the Nest gateway via /api/v1. This middleware is NEVER
 * included in a production build. It keeps demo credentials and role checks
 * server-side so the three sign-in journeys work without PostgreSQL setup. */
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import { LISTINGS, PICKUP_WINDOWS, PRODUCTS, STORES } from '../src/data/catalog'

type Role = 'CUSTOMER' | 'SELLER' | 'DELIVERY_PARTNER' | 'ADMIN'
type Account = { id: string; name: string; email: string; phone?: string; role: Role; hash: Buffer }
type Session = { userId: string; csrf: string; expires: number }
type DemoJob = {
  id: string
  orderId?: string
  number: string
  status: string
  fee: number
  distanceKm: number
  packageCount: number
  pickup: { name: string; area: string; address: string }
  items: { name: string; qty: number }[]
  partnerId: string | null
  drop: string
  pickupCode: string
  dropCode: string
}

type DemoOrder = {
  id: string
  number: string
  userId?: string
  status: string
  fulfillmentMethod?: 'LOCAL_DELIVERY' | 'NEARBY_PICKUP'
  total: number
  deliveryFee?: number
  createdAt: string
  storeId: string
  items: { name: string; qty: number; unitPrice: number; productId?: string; storeId?: string }[]
  user: { name: string; phone: string }
  events?: { label: string; at: string }[]
}
type DemoReservation = {
  id: string
  userId?: string
  code: string
  status: string
  createdAt: string
  pickupWindow: string
  expiresAt?: string
  storeId: string
  items: { qty: number; productId?: string; storeId?: string; unitPrice?: number; product: { name: string; emoji: string } }[]
  events?: { label: string; at: string }[]
}
type InventoryItem = {
  id: string
  productId: string
  name: string
  brand: string
  emoji: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  price: number
  status: string
  confidence: string
  updatedMinsAgo: number
}

const hash = (password: string) => scryptSync(password, 'nearbuy-preview-only', 32)
const accounts = new Map<string, Account>(
  (
    [
      {
        id: 'demo-customer',
        name: 'Aarav Sharma',
        email: 'customer@nearbuy.dev',
        phone: '+919810000001',
        role: 'CUSTOMER',
        hash: hash('Customer@123'),
      },
      {
        id: 'demo-seller',
        name: 'Rajesh Malhotra',
        email: 'seller.sports@nearbuy.dev',
        phone: '+919820000010',
        role: 'SELLER',
        hash: hash('Seller@123'),
      },
      {
        id: 'demo-rider',
        name: 'Arjun Rider',
        email: 'delivery@nearbuy.dev',
        phone: '+919810000011',
        role: 'DELIVERY_PARTNER',
        hash: hash('Delivery@123'),
      },
      {
        id: 'demo-admin',
        name: 'NearBuy Admin',
        email: 'admin@nearbuy.dev',
        role: 'ADMIN',
        hash: hash('Admin@123'),
      },
    ] as Account[]
  ).map((a) => [a.email, a]),
)
const sessions = new Map<string, Session>()
const otpCodes = new Map<string, { code: string; expires: number }>()
const sellerProfiles = new Map<
  string,
  {
    id: string
    legalName: string
    verified: boolean
    stores: {
      id: string
      name: string
      area: string
      address?: string
      hours?: string
      verified: boolean
      open: boolean
      inventory: unknown[]
    }[]
  }
>([
  [
    'demo-seller',
    {
      id: 'demo-business',
      legalName: 'Malhotra Sports',
      verified: true,
      stores: [
        {
          id: 'demo-store',
          name: 'ABC Sports',
          area: 'Sector 22 Market, Dwarka',
          address: 'Shop 14, Sector 22 Market, Dwarka, Delhi',
          hours: '9:00 AM – 9:00 PM',
          verified: true,
          open: true,
          inventory: [],
        },
      ],
    },
  ],
])
const sellerOrders: DemoOrder[] = [
  {
    id: 'demo-order-1',
    number: 'NB-2407',
    status: 'PENDING',
    total: 1299,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    storeId: 'demo-store',
    items: [{ name: 'Nivia Volleyball — Storm Rubber', qty: 1, unitPrice: 1299 }],
    user: { name: 'Meera Iyer', phone: '+91 98••• ••002' },
  },
  {
    id: 'demo-order-2',
    number: 'NB-2406',
    status: 'CONFIRMED',
    total: 4199,
    createdAt: new Date(Date.now() - 50 * 60_000).toISOString(),
    storeId: 'demo-store',
    items: [{ name: 'SG Willow Cricket Bat (Full Size)', qty: 1, unitPrice: 4199 }],
    user: { name: 'Aarav Sharma', phone: '+91 98••• ••001' },
  },
  {
    id: 'demo-order-3',
    number: 'NB-2405',
    status: 'COMPLETED',
    total: 699,
    createdAt: new Date(Date.now() - 26 * 36e5).toISOString(),
    storeId: 'demo-store',
    items: [{ name: 'Tynor Yoga Mat 6mm', qty: 1, unitPrice: 699 }],
    user: { name: 'Neha K.', phone: '+91 98••• ••540' },
  },
]
const sellerReservations: DemoReservation[] = [
  {
    id: 'demo-res-1',
    code: 'NB-4417',
    status: 'REQUESTED',
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    pickupWindow: 'Today · 5:00–5:30 PM',
    storeId: 'demo-store',
    items: [{ qty: 1, product: { name: 'SG Willow Cricket Bat (Full Size)', emoji: '🏏' } }],
  },
]
const inventory: InventoryItem[] = [
  {
    id: 'inv-1',
    productId: 'p1',
    name: 'Nivia Volleyball — Storm Rubber',
    brand: 'Nivia',
    emoji: '🏐',
    quantity: 11,
    reservedQuantity: 0,
    availableQuantity: 11,
    price: 1299,
    status: 'ACTIVE',
    confidence: 'FRESH',
    updatedMinsAgo: 8,
  },
  {
    id: 'inv-2',
    productId: 'p2',
    name: 'SG Test Cricket Ball (Pack of 2)',
    brand: 'SG',
    emoji: '🏏',
    quantity: 22,
    reservedQuantity: 0,
    availableQuantity: 22,
    price: 899,
    status: 'ACTIVE',
    confidence: 'FRESH',
    updatedMinsAgo: 12,
  },
  {
    id: 'inv-3',
    productId: 'p3',
    name: 'Yonex Nanoray Light Racquet',
    brand: 'Yonex',
    emoji: '🏸',
    quantity: 3,
    reservedQuantity: 0,
    availableQuantity: 3,
    price: 2499,
    status: 'ACTIVE',
    confidence: 'FRESH',
    updatedMinsAgo: 36,
  },
  {
    id: 'inv-4',
    productId: 'p4',
    name: 'Nivia Football Shoes — Dominator',
    brand: 'Nivia',
    emoji: '👟',
    quantity: 2,
    reservedQuantity: 0,
    availableQuantity: 2,
    price: 3299,
    status: 'LOW_STOCK',
    confidence: 'STALE',
    updatedMinsAgo: 180,
  },
  {
    id: 'inv-5',
    productId: 'p5',
    name: 'SG Willow Cricket Bat (Full Size)',
    brand: 'SG',
    emoji: '🏏',
    quantity: 4,
    reservedQuantity: 0,
    availableQuantity: 4,
    price: 4199,
    status: 'ACTIVE',
    confidence: 'STALE',
    updatedMinsAgo: 280,
  },
]
const jobs: DemoJob[] = [
  {
    id: 'demo-job-1',
    number: 'NB-2409',
    status: 'PENDING',
    fee: 42,
    distanceKm: 1.2,
    packageCount: 1,
    partnerId: null,
    pickup: {
      name: 'City Electronics',
      area: 'Sector 22 Market',
      address: 'Shop 6, Sector 22 Market, Dwarka',
    },
    drop: 'Sector 23, Dwarka',
    items: [{ name: 'Wireless headphones', qty: 1 }],
    pickupCode: '4417',
    dropCode: '8821',
  },
  {
    id: 'demo-job-2',
    number: 'NB-2410',
    status: 'PENDING',
    fee: 56,
    distanceKm: 2.4,
    packageCount: 2,
    partnerId: null,
    pickup: { name: 'Pen & Paper', area: 'Sector 21', address: 'B-4, Sector 21, Dwarka' },
    drop: 'Sector 19, Dwarka',
    items: [{ name: 'School supplies', qty: 2 }],
    pickupCode: '1034',
    dropCode: '6820',
  },
]
// New preview purchases are kept on the API server, not in a buyer's browser.
// Reloading or signing in as another role sees the same order lifecycle.
const commerceOrders: DemoOrder[] = []
const commerceReservations: DemoReservation[] = []
const stockRequests: { id: string; storeId: string; productId: string; userId: string; qty: number; status: 'PENDING' | 'AVAILABLE' | 'NOT_AVAILABLE'; createdAt: string; respondedAt?: string }[] = []
const stockLeft = new Map(LISTINGS.map((listing) => [`${listing.storeId}:${listing.productId}`, listing.stock]))

const riderState = new Map<
  string,
  { available: boolean; balance: number; completed: number; recent: { order: string; fee: number }[] }
>([
  [
    'demo-rider',
    {
      available: true,
      balance: 4860,
      completed: 132,
      recent: [
        { order: 'NB-2403', fee: 48 },
        { order: 'NB-2401', fee: 42 },
        { order: 'NB-2398', fee: 56 },
      ],
    },
  ],
])

function publicUser(account: Account) {
  return { id: account.id, name: account.name, role: account.role }
}
function cookie(req: IncomingMessage, name: string) {
  return req.headers.cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}
function send(res: ServerResponse, status: number, data?: unknown, message?: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(
    JSON.stringify(
      status < 400
        ? { success: true, data, requestId: 'preview' }
        : {
            success: false,
            error: {
              code:
                status === 401
                  ? 'UNAUTHORIZED'
                  : status === 403
                    ? 'FORBIDDEN'
                    : status === 404
                      ? 'NOT_FOUND'
                      : 'REQUEST_FAILED',
              message: message ?? 'Request failed.',
            },
            requestId: 'preview',
          },
    ),
  )
}
function issue(req: IncomingMessage, res: ServerResponse, account: Account) {
  const token = randomBytes(32).toString('hex')
  const csrf = randomBytes(16).toString('hex')
  sessions.set(token, { userId: account.id, csrf, expires: Date.now() + 24 * 36e5 })
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
  res.setHeader('Set-Cookie', [
    `nb_sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secure}`,
    `nb_csrf=${csrf}; Path=/; SameSite=Lax; Max-Age=86400${secure}`,
  ])
  send(res, 200, { user: publicUser(account) })
}
function accountFor(req: IncomingMessage): Account | undefined {
  const token = cookie(req, 'nb_sid')
  const session = token && sessions.get(token)
  if (!session || session.expires < Date.now()) return undefined
  return [...accounts.values()].find((a) => a.id === session.userId)
}
function protectedAccount(req: IncomingMessage, res: ServerResponse, roles?: Role[]): Account | undefined {
  const account = accountFor(req)
  if (!account) {
    send(res, 401, undefined, 'Please sign in to continue.')
    return
  }
  if (roles && !roles.includes(account.role)) {
    send(res, 403, undefined, 'This workspace is not available for your account.')
    return
  }
  if (req.method !== 'GET') {
    const session = sessions.get(cookie(req, 'nb_sid')!)!
    if (req.headers['x-csrf-token'] !== session.csrf || cookie(req, 'nb_csrf') !== session.csrf) {
      send(res, 403, undefined, 'Your session has expired. Please refresh and try again.')
      return
    }
  }
  return account
}
async function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  let body = ''
  for await (const chunk of req) {
    body += chunk.toString()
    if (body.length > 16_384) throw new Error('Request too large')
  }
  try {
    return body ? JSON.parse(body) : {}
  } catch {
    throw new Error('Invalid JSON')
  }
}
function jobView(job: DemoJob) {
  return {
    id: job.id,
    number: job.number,
    status: job.status,
    fee: job.fee,
    distanceKm: job.distanceKm,
    packageCount: job.packageCount,
    pickup: job.pickup,
    drop: job.partnerId ? job.drop : 'Dwarka, Delhi',
    items: job.items,
  }
}
function stockKey(storeId: string, productId: string) { return `${storeId}:${productId}` }
function sellerOrderView(order: DemoOrder) {
  const delivery = jobs.find((job) => job.orderId === order.id)
  return {
    ...order,
    delivery: delivery ? { status: delivery.status, pickupCode: delivery.pickupCode } : null,
  }
}
function buyerOrderView(order: DemoOrder) {
  const delivery = jobs.find((job) => job.orderId === order.id)
  const courier = delivery?.partnerId ? [...accounts.values()].find((a) => a.id === delivery.partnerId) : undefined
  return {
    ...order,
    delivery: delivery ? { status: delivery.status, dropCode: delivery.dropCode, courier: courier?.name } : null,
  }
}
function holdStock(storeId: string, productId: string, qty: number) {
  const key = stockKey(storeId, productId)
  stockLeft.set(key, (stockLeft.get(key) ?? 0) - qty)
  if (storeId === 's1') {
    const item = inventory.find((entry) => entry.productId === productId)
    if (item) {
      item.reservedQuantity += qty
      item.availableQuantity -= qty
      item.status = item.availableQuantity <= 0 ? 'OUT_OF_STOCK' : item.availableQuantity <= 4 ? 'LOW_STOCK' : 'ACTIVE'
      item.updatedMinsAgo = 0
    }
  }
}
function releaseStock(items: { productId?: string; storeId?: string; qty: number }[]) {
  for (const line of items) {
    if (!line.productId || !line.storeId) continue
    const key = stockKey(line.storeId, line.productId)
    stockLeft.set(key, (stockLeft.get(key) ?? 0) + line.qty)
    if (line.storeId === 's1') {
      const item = inventory.find((entry) => entry.productId === line.productId)
      if (item) {
        item.availableQuantity += line.qty
        item.reservedQuantity -= line.qty
        item.status = item.availableQuantity <= 4 ? 'LOW_STOCK' : 'ACTIVE'
      }
    }
  }
}
function settleStock(items: { productId?: string; storeId?: string; qty: number }[]) {
  for (const line of items) {
    if (line.storeId !== 's1') continue
    const item = inventory.find((entry) => entry.productId === line.productId)
    if (item) {
      item.reservedQuantity -= line.qty
      item.quantity -= line.qty
    }
  }
}

export function demoApi(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/api/v1/')) return next()
    void (async () => {
      const url = new URL(req.url!, 'http://localhost')
      const path = url.pathname.slice('/api/v1'.length)
      const method = req.method ?? 'GET'

      if (path === '/auth/login' && method === 'POST') {
        const body = await readBody(req)
        const account = accounts.get(String(body.email || '').toLowerCase())
        if (!account || !timingSafeEqual(account.hash, hash(String(body.password || ''))))
          return send(res, 401, undefined, 'Incorrect email or password.')
        return issue(req, res, account)
      }
      if (path === '/auth/register' && method === 'POST') {
        const body = await readBody(req)
        const email = String(body.email || '')
          .trim()
          .toLowerCase()
        const name = String(body.name || '').trim()
        if (
          !/^\S+@\S+\.\S+$/.test(email) ||
          name.length < 2 ||
          String(body.password || '').length < 8 ||
          !['CUSTOMER', 'SELLER', 'DELIVERY_PARTNER'].includes(body.role)
        )
          return send(res, 400, undefined, 'Please check your account details.')
        if (accounts.has(email))
          return send(res, 409, undefined, 'An account with this email already exists.')
        const account: Account = {
          id: randomBytes(8).toString('hex'),
          name,
          email,
          role: body.role,
          hash: hash(body.password),
        }
        accounts.set(email, account)
        if (account.role === 'DELIVERY_PARTNER')
          riderState.set(account.id, { available: true, balance: 0, completed: 0, recent: [] })
        return issue(req, res, account)
      }
      if (path === '/auth/otp/request' && method === 'POST') {
        const { phone } = await readBody(req)
        if (!/^\+?[0-9]{10,15}$/.test(String(phone || '')))
          return send(res, 400, undefined, 'Enter a valid phone number.')
        const code = String(randomInt(100000, 1000000))
        otpCodes.set(phone, { code, expires: Date.now() + 300_000 })
        return send(res, 200, { sent: true, devCode: code })
      }
      if (path === '/auth/otp/verify' && method === 'POST') {
        const { phone, code } = await readBody(req)
        const stored = otpCodes.get(phone)
        if (!stored || stored.code !== String(code) || stored.expires < Date.now())
          return send(res, 401, undefined, 'Invalid or expired code.')
        otpCodes.delete(phone)
        let account = [...accounts.values()].find((a) => a.phone === phone)
        if (!account) {
          account = {
            id: randomBytes(8).toString('hex'),
            name: 'NearBuy Customer',
            email: `phone-${phone}@nearbuy.preview`,
            phone,
            role: 'CUSTOMER',
            hash: hash(randomBytes(20).toString('hex')),
          }
          accounts.set(account.email, account)
        }
        return issue(req, res, account)
      }
      if (path === '/auth/refresh' && method === 'POST') {
        const account = accountFor(req)
        return account ? issue(req, res, account) : send(res, 401, undefined, 'Session expired.')
      }
      if (path === '/auth/me' && method === 'GET') {
        const account = protectedAccount(req, res)
        return account && send(res, 200, publicUser(account))
      }
      if (path === '/auth/logout' && method === 'POST') {
        const token = cookie(req, 'nb_sid')
        if (token) sessions.delete(token)
        res.setHeader('Set-Cookie', [
          'nb_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
          'nb_csrf=; Path=/; SameSite=Lax; Max-Age=0',
        ])
        return send(res, 200, { ok: true })
      }

      // The preview mirrors the gateway's checkout endpoints. Prices, stock,
      // ownership and handoff codes live here, never in localStorage or the URL.
      if (path === '/preview/catalog' && method === 'GET') {
        const account = protectedAccount(req, res, ['CUSTOMER'])
        if (!account) return
        return send(res, 200, {
          stores: [{ id: 's1', open: sellerProfiles.get('demo-seller')!.stores[0].open }],
          stock: [...stockLeft].map(([key, stock]) => {
            const [storeId, productId] = key.split(':')
            const listing = LISTINGS.find((l) => l.storeId === storeId && l.productId === productId)
            return { storeId, productId, stock, price: listing?.price, updatedMinsAgo: listing?.updatedMinsAgo }
          }),
        })
      }
      if ((path === '/checkout/orders' || path === '/checkout/reservations') && method === 'POST') {
        const account = protectedAccount(req, res, ['CUSTOMER'])
        if (!account) return
        const body = await readBody(req)
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 40)
          return send(res, 400, undefined, 'Add at least one product to your cart.')
        const lines = new Map<string, { productId: string; storeId: string; qty: number }>()
        for (const raw of body.items) {
          if (typeof raw?.productId !== 'string' || typeof raw?.storeId !== 'string' || !Number.isInteger(raw.qty) || raw.qty < 1 || raw.qty > 99)
            return send(res, 400, undefined, 'Check your cart quantities and try again.')
          const key = stockKey(raw.storeId, raw.productId)
          const current = lines.get(key)
          const qty = raw.qty + (current?.qty ?? 0)
          if (qty > 99) return send(res, 400, undefined, 'A product can have up to 99 items per order.')
          lines.set(key, { productId: raw.productId, storeId: raw.storeId, qty })
        }
        const groups = new Map<string, { store: (typeof STORES)[number]; items: { name: string; productId: string; storeId: string; qty: number; unitPrice: number }[] }>()
        const reserving = path === '/checkout/reservations'
        if (reserving && (typeof body.pickupWindow !== 'string' || !PICKUP_WINDOWS.includes(body.pickupWindow)))
          return send(res, 400, undefined, 'Choose an available pickup window.')
        if (!reserving && !['LOCAL_DELIVERY', 'NEARBY_PICKUP'].includes(body.fulfillment))
          return send(res, 400, undefined, 'Choose delivery or pickup to continue.')
        if (!reserving && !['UPI', 'CARD', 'COD', 'PAY_AT_STORE'].includes(body.paymentMethod))
          return send(res, 400, undefined, 'Choose a valid payment method.')
        if (!reserving && body.fulfillment === 'LOCAL_DELIVERY' && (typeof body.addressLine !== 'string' || body.addressLine.trim().length < 8 || body.addressLine.length > 180))
          return send(res, 400, undefined, 'Add a complete delivery address.')
        for (const line of lines.values()) {
          const store = STORES.find((entry) => entry.id === line.storeId)
          const product = PRODUCTS.find((entry) => entry.id === line.productId)
          const listing = LISTINGS.find((entry) => entry.storeId === line.storeId && entry.productId === line.productId)
          if (!store || !product || !listing) return send(res, 400, undefined, 'One of these products is no longer offered by this store.')
          const isOpen = line.storeId === 's1' ? sellerProfiles.get('demo-seller')!.stores[0].open : store.open
          if (!isOpen) return send(res, 409, undefined, `${store.name} is closed right now. Choose another store.`)
          if (reserving && (!store.pickup || !listing.reserveable)) return send(res, 409, undefined, `${product.name} cannot be reserved at ${store.name}.`)
          if (!reserving && body.fulfillment === 'NEARBY_PICKUP' && !store.pickup)
            return send(res, 409, undefined, `${store.name} does not offer pickup.`)
          if (!reserving && body.fulfillment === 'LOCAL_DELIVERY' && !store.localDelivery)
            return send(res, 409, undefined, `${store.name} does not deliver locally.`)
          if ((stockLeft.get(stockKey(line.storeId, line.productId)) ?? 0) < line.qty)
            return send(res, 409, undefined, `There aren't enough ${product.name} left at ${store.name}.`)
          const group = groups.get(line.storeId) ?? { store, items: [] }
          group.items.push({ name: product.name, productId: line.productId, storeId: line.storeId, qty: line.qty, unitPrice: listing.price })
          groups.set(line.storeId, group)
        }
        if (reserving && groups.size !== 1)
          return send(res, 400, undefined, 'Reserve & Pickup is available for one store at a time.')
        const now = new Date().toISOString()
        if (reserving) {
          const [storeId, group] = [...groups][0]
          const reservation: DemoReservation = {
            id: randomBytes(8).toString('hex'),
            userId: account.id,
            code: `NB-${randomInt(4000, 9999)}`,
            status: 'REQUESTED',
            createdAt: now,
            expiresAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
            pickupWindow: body.pickupWindow,
            storeId: storeId === 's1' ? 'demo-store' : storeId,
            items: group.items.map((item) => ({ qty: item.qty, productId: item.productId, storeId, unitPrice: item.unitPrice, product: { name: item.name, emoji: PRODUCTS.find((p) => p.id === item.productId)!.emoji } })),
            events: [{ label: 'Requested', at: now }],
          }
          for (const item of group.items) holdStock(storeId, item.productId, item.qty)
          commerceReservations.unshift(reservation)
          return send(res, 200, reservation)
        }
        const created: DemoOrder[] = []
        for (const [storeId, group] of groups) {
          const delivery = body.fulfillment === 'LOCAL_DELIVERY'
          const number = `NB-${randomInt(30000, 99999)}`
          const order: DemoOrder = {
            id: randomBytes(8).toString('hex'),
            number,
            userId: account.id,
            status: 'PENDING',
            fulfillmentMethod: delivery ? 'LOCAL_DELIVERY' : 'NEARBY_PICKUP',
            total: group.items.reduce((total, item) => total + item.qty * item.unitPrice, delivery ? 30 : 0),
            deliveryFee: delivery ? 30 : 0,
            createdAt: now,
            storeId: storeId === 's1' ? 'demo-store' : storeId,
            items: group.items,
            user: { name: account.name, phone: account.phone ?? '' },
            events: [{ label: 'Order placed', at: now }],
          }
          for (const item of group.items) holdStock(storeId, item.productId, item.qty)
          commerceOrders.unshift(order)
          created.push(order)
          if (delivery) {
            jobs.unshift({
              id: randomBytes(8).toString('hex'), orderId: order.id, number,
              status: 'PENDING', partnerId: null, fee: 24, distanceKm: 1.2,
              packageCount: group.items.reduce((count, item) => count + item.qty, 0),
              pickup: { name: group.store.name, area: group.store.area, address: group.store.address },
              drop: String(body.addressLine || 'Dwarka Sector 22').slice(0, 180),
              items: group.items.map((item) => ({ name: item.name, qty: item.qty })),
              pickupCode: String(randomInt(1000, 10000)), dropCode: String(randomInt(1000, 10000)),
            })
          }
        }
        return send(res, 200, { orders: created.map(buyerOrderView) })
      }
      if (path === '/orders' || path === '/reservations' || /^\/(orders|reservations)\/[^/]+\/(track|cancel)$/.test(path)) {
        // Seller listing and seller actions are handled below, with a separate
        // role guard. A buyer cannot ask for another user's purchases.
        if (url.searchParams.get('role') !== 'seller') {
          const account = protectedAccount(req, res, ['CUSTOMER'])
          if (!account) return
          if (path === '/orders' && method === 'GET')
            return send(res, 200, commerceOrders.filter((o) => o.userId === account.id).map(buyerOrderView))
          if (path === '/reservations' && method === 'GET')
            return send(res, 200, commerceReservations.filter((r) => r.userId === account.id))
          const track = path.match(/^\/orders\/([^/]+)\/track$/)
          if (track && method === 'GET') {
            const order = commerceOrders.find((o) => o.id === track[1] && o.userId === account.id)
            return order ? send(res, 200, buyerOrderView(order)) : send(res, 404, undefined, 'Order not found.')
          }
          const cancel = path.match(/^\/(orders|reservations)\/([^/]+)\/cancel$/)
          if (cancel && method === 'POST') {
            if (cancel[1] === 'orders') {
              const order = commerceOrders.find((o) => o.id === cancel[2] && o.userId === account.id)
              if (!order) return send(res, 404, undefined, 'Order not found.')
              if (!['PENDING', 'CONFIRMED'].includes(order.status)) return send(res, 409, undefined, 'This order can no longer be cancelled.')
              order.status = 'CANCELLED'
              order.events?.push({ label: 'Cancelled', at: new Date().toISOString() })
              releaseStock(order.items)
              const job = jobs.find((j) => j.orderId === order.id)
              if (job) job.status = 'CANCELLED'
              return send(res, 200, buyerOrderView(order))
            }
            const reservation = commerceReservations.find((r) => r.id === cancel[2] && r.userId === account.id)
            if (!reservation) return send(res, 404, undefined, 'Reservation not found.')
            if (!['REQUESTED', 'CONFIRMED', 'PACKING'].includes(reservation.status)) return send(res, 409, undefined, 'This reservation can no longer be cancelled.')
            reservation.status = 'CANCELLED'
            reservation.events?.push({ label: 'Cancelled', at: new Date().toISOString() })
            releaseStock(reservation.items)
            return send(res, 200, reservation)
          }
        }
      }

      if (path === '/stock-requests' || path === '/stock-requests/mine') {
        const account = protectedAccount(req, res, ['CUSTOMER'])
        if (!account) return
        if (path === '/stock-requests/mine' && method === 'GET')
          return send(res, 200, stockRequests.filter((r) => r.userId === account.id))
        if (path === '/stock-requests' && method === 'POST') {
          const body = await readBody(req)
          const listing = LISTINGS.find((l) => l.storeId === body.storeId && l.productId === body.productId)
          if (!listing || !Number.isInteger(body.qty) || body.qty < 1 || body.qty > 99)
            return send(res, 400, undefined, 'Choose a listed product and a valid quantity.')
          const pending = stockRequests.find((r) => r.userId === account.id && r.storeId === body.storeId && r.productId === body.productId && r.status === 'PENDING')
          if (pending) return send(res, 200, pending)
          const request = { id: randomBytes(8).toString('hex'), userId: account.id, storeId: body.storeId, productId: body.productId, qty: body.qty, status: 'PENDING' as const, createdAt: new Date().toISOString() }
          stockRequests.unshift(request)
          return send(res, 200, request)
        }
        return send(res, 404, undefined, 'Not found in preview.')
      }

      if (
        path.startsWith('/sellers') ||
        path.startsWith('/inventory') ||
        (path === '/orders' && url.searchParams.get('role') === 'seller') ||
        /^\/orders\/[^/]+\/(accept|preparing|packed|ready|complete)$/.test(path) ||
        (path === '/reservations' && url.searchParams.get('role') === 'seller') ||
        /^\/reservations\/[^/]+\/(confirm|reject|pack|ready|arrive|collect|complete)$/.test(path)
      ) {
        const account = protectedAccount(req, res, ['SELLER'])
        if (!account) return
        const profile = sellerProfiles.get(account.id)
        if (path === '/sellers/register' && method === 'POST') {
          if (profile) return send(res, 409, undefined, 'You already have a store.')
          const body = await readBody(req)
          if (!String(body.legalName || '').trim() || !String(body.store?.name || '').trim())
            return send(res, 400, undefined, 'Add your business and store name.')
          const newProfile = {
            id: randomBytes(8).toString('hex'),
            legalName: String(body.legalName),
            verified: false,
            stores: [
              {
                id: randomBytes(8).toString('hex'),
                name: String(body.store.name),
                area: String(body.store.area || 'Dwarka'),
                address: String(body.store.address || ''),
                hours: String(body.store.hours || '9:00 AM – 9:00 PM'),
                verified: false,
                open: true,
                inventory: [],
              },
            ],
          }
          sellerProfiles.set(account.id, newProfile)
          return send(res, 200, newProfile)
        }
        if (path === '/sellers/me' && method === 'GET')
          return profile
            ? send(res, 200, profile)
            : send(res, 404, undefined, 'Create your store to get started.')
        const updateStore = path.match(/^\/sellers\/stores\/([^/]+)$/)
        if (updateStore && method === 'PATCH') {
          const store = profile?.stores.find((s) => s.id === updateStore[1])
          if (!store) return send(res, 404, undefined, 'Your store was not found.')
          const body = await readBody(req)
          if (typeof body.open !== 'boolean') return send(res, 400, undefined, 'Choose a valid store status.')
          store.open = body.open
          return send(res, 200, store)
        }
        const isDemoSeller = account.id === 'demo-seller'
        const owns = (storeId: string) => !!profile?.stores.some((s) => s.id === storeId)
        if (path === '/orders' && method === 'GET')
          return send(res, 200, [...commerceOrders.filter((o) => owns(o.storeId)), ...(isDemoSeller ? sellerOrders : [])].map(sellerOrderView))
        if (path === '/reservations' && method === 'GET')
          return send(res, 200, [...commerceReservations.filter((r) => owns(r.storeId)), ...(isDemoSeller ? sellerReservations : [])])
        if (path === '/inventory/confirm-requests' && method === 'GET')
          return send(res, 200, stockRequests.filter((r) => r.status === 'PENDING' && owns(r.storeId === 's1' ? 'demo-store' : r.storeId)).map((r) => ({ ...r, product: PRODUCTS.find((p) => p.id === r.productId) })))
        const confirmRequest = path.match(/^\/inventory\/confirm-requests\/([^/]+)\/respond$/)
        if (confirmRequest && method === 'POST') {
          const item = stockRequests.find((r) => r.id === confirmRequest[1] && owns(r.storeId === 's1' ? 'demo-store' : r.storeId))
          if (!item) return send(res, 404, undefined, 'Stock request not found for this store.')
          if (item.status !== 'PENDING') return send(res, 409, undefined, 'This request has already been answered.')
          const body = await readBody(req)
          if (typeof body.available !== 'boolean') return send(res, 400, undefined, 'Choose whether the item is available.')
          item.status = body.available ? 'AVAILABLE' : 'NOT_AVAILABLE'
          item.respondedAt = new Date().toISOString()
          if (body.available) {
            const listing = LISTINGS.find((l) => l.storeId === item.storeId && l.productId === item.productId)
            if (listing) listing.updatedMinsAgo = 0
          }
          return send(res, 200, item)
        }
        if (path === '/inventory' && method === 'GET') return send(res, 200, isDemoSeller ? inventory : [])
        if (path === '/inventory/bulk' && method === 'POST' && isDemoSeller) {
          const body = await readBody(req)
          for (const change of body.items ?? []) {
            const item = inventory.find((x) => x.productId === change.productId)
            if (item && Number.isInteger(change.quantity) && change.quantity >= item.reservedQuantity) {
              item.quantity = change.quantity
              item.price = Number(change.price)
              item.availableQuantity = item.quantity - item.reservedQuantity
              item.status = item.availableQuantity ? 'ACTIVE' : 'OUT_OF_STOCK'
              item.confidence = 'FRESH'
              item.updatedMinsAgo = 0
              stockLeft.set(stockKey('s1', item.productId), item.availableQuantity)
              const listing = LISTINGS.find((entry) => entry.storeId === 's1' && entry.productId === item.productId)
              if (listing) { listing.price = item.price; listing.updatedMinsAgo = 0 }
            }
          }
          return send(res, 200, { ok: true })
        }
        const orderAction = path.match(/^\/orders\/([^/]+)\/(accept|preparing|packed|ready|complete)$/)
        if (orderAction && method === 'POST') {
          const order = [...commerceOrders, ...(isDemoSeller ? sellerOrders : [])].find((x) => x.id === orderAction[1] && owns(x.storeId))
          const transitions: Record<string, [string[], string]> = {
            accept: [['PENDING'], 'CONFIRMED'],
            preparing: [['CONFIRMED'], 'PREPARING'],
            packed: [['PREPARING', 'CONFIRMED'], 'PACKED'],
            ready: [['PACKED'], 'READY_FOR_PICKUP'],
            complete: [['PACKED', 'READY_FOR_PICKUP'], 'COMPLETED'],
          }
          const [from, to] = transitions[orderAction[2]]
          if (!order || !from.includes(order.status))
            return send(res, 409, undefined, 'This order has moved on. Refresh to see the latest status.')
          if (orderAction[2] === 'complete' && order.fulfillmentMethod === 'LOCAL_DELIVERY')
            return send(res, 409, undefined, 'The rider completes delivery orders after the customer handoff.')
          order.status = to
          order.events?.push({ label: { accept: 'Order confirmed', preparing: 'Seller preparing', packed: 'Packed', ready: 'Ready for pickup', complete: 'Completed' }[orderAction[2]]!, at: new Date().toISOString() })
          if (to === 'COMPLETED' && order.userId) settleStock(order.items)
          return send(res, 200, sellerOrderView(order))
        }
        const reservationAction = path.match(
          /^\/reservations\/([^/]+)\/(confirm|reject|pack|ready|arrive|collect|complete)$/,
        )
        if (reservationAction && method === 'POST') {
          const reservation = [...commerceReservations, ...(isDemoSeller ? sellerReservations : [])].find((x) => x.id === reservationAction[1] && owns(x.storeId))
          const transitions: Record<string, [string[], string]> = {
            confirm: [['REQUESTED'], 'CONFIRMED'],
            reject: [['REQUESTED'], 'REJECTED'],
            pack: [['CONFIRMED'], 'PACKING'],
            ready: [['PACKING'], 'READY_FOR_PICKUP'],
            arrive: [['READY_FOR_PICKUP'], 'CUSTOMER_ARRIVED'],
            collect: [['CUSTOMER_ARRIVED'], 'COLLECTED'],
            complete: [['COLLECTED'], 'COMPLETED'],
          }
          const [from, to] = transitions[reservationAction[2]]
          if (!reservation || !from.includes(reservation.status))
            return send(
              res,
              409,
              undefined,
              'This reservation has moved on. Refresh to see the latest status.',
            )
          reservation.status = to
          reservation.events?.push({ label: { confirm: 'Confirmed', reject: 'Rejected', pack: 'Packed', ready: 'Ready for pickup', arrive: 'Customer arrived', collect: 'Collected', complete: 'Completed' }[reservationAction[2]]!, at: new Date().toISOString() })
          if (reservation.userId && to === 'REJECTED') releaseStock(reservation.items)
          if (reservation.userId && to === 'COMPLETED') settleStock(reservation.items)
          return send(res, 200, reservation)
        }
        return send(res, 404, undefined, 'Not found in preview.')
      }

      if (path.startsWith('/delivery/')) {
        const account = protectedAccount(req, res, ['DELIVERY_PARTNER'])
        if (!account) return
        const state = riderState.get(account.id) ?? { available: true, balance: 0, completed: 0, recent: [] }
        if (path === '/delivery/jobs' && method === 'GET')
          return send(res, 200, {
            available: jobs.filter((j) => !j.partnerId && j.status === 'PENDING').map(jobView),
            active: jobs
              .filter(
                (j) => j.partnerId === account.id && !['DELIVERED', 'CANCELLED', 'FAILED'].includes(j.status),
              )
              .map(jobView),
          })
        if (path === '/delivery/earnings' && method === 'GET')
          return send(res, 200, { balance: state.balance, completed: state.completed, recent: state.recent })
        if (path === '/delivery/performance' && method === 'GET')
          return send(res, 200, {
            rating: account.id === 'demo-rider' ? 4.8 : 5,
            deliveries: state.completed,
            zone: 'Dwarka',
            available: state.available,
            vehicle: 'Bike',
          })
        if (path === '/delivery/availability' && method === 'PATCH') {
          const body = await readBody(req)
          if (typeof body.available !== 'boolean')
            return send(res, 400, undefined, 'Choose a valid availability status.')
          state.available = body.available
          riderState.set(account.id, state)
          return send(res, 200, { available: state.available })
        }
        const accept = path.match(/^\/delivery\/jobs\/([^/]+)\/accept$/)
        if (accept && method === 'POST') {
          const job = jobs.find((j) => j.id === accept[1] && j.status === 'PENDING' && !j.partnerId)
          if (!job) return send(res, 409, undefined, 'This delivery has already been accepted.')
          if (!state.available) return send(res, 409, undefined, 'Go online to accept deliveries.')
          job.partnerId = account.id
          job.status = 'ASSIGNED'
          return send(res, 200, jobView(job))
        }
        const event = path.match(/^\/delivery\/([^/]+)\/events$/)
        if (event && method === 'POST') {
          const job = jobs.find((j) => j.id === event[1] && j.partnerId === account.id)
          if (!job) return send(res, 404, undefined, 'This delivery is not assigned to you.')
          const body = await readBody(req)
          const nextStatus: Record<string, string> = {
            ASSIGNED: 'AT_STORE',
            AT_STORE: 'PICKED_UP',
            PICKED_UP: 'AT_CUSTOMER',
            AT_CUSTOMER: 'DELIVERED',
          }
          if (nextStatus[job.status] !== body.status)
            return send(res, 409, undefined, 'This is not the next delivery step.')
          const order = commerceOrders.find((entry) => entry.id === job.orderId)
          if (body.status === 'PICKED_UP' && order && order.status !== 'READY_FOR_PICKUP')
            return send(res, 409, undefined, 'The store has not marked this order ready yet.')
          if (body.status === 'PICKED_UP' && body.code !== job.pickupCode)
            return send(res, 400, undefined, 'Ask the store for the correct pickup code.')
          if (body.status === 'DELIVERED' && body.code !== job.dropCode)
            return send(res, 400, undefined, 'Ask the customer for the correct handoff code.')
          job.status = body.status
          if (order && body.status === 'PICKED_UP')
            order.events?.push({ label: 'Out for delivery', at: new Date().toISOString() })
          if (body.status === 'DELIVERED') {
            if (order) {
              order.status = 'COMPLETED'
              order.events?.push({ label: 'Delivered', at: new Date().toISOString() })
              settleStock(order.items)
            }
            state.completed += 1
            state.balance += job.fee
            state.recent.unshift({ order: job.number, fee: job.fee })
            riderState.set(account.id, state)
          }
          return send(res, 200, jobView(job))
        }
        return send(res, 404, undefined, 'Not found in preview.')
      }
      return send(res, 404, undefined, 'This endpoint is only available on the full gateway.')
    })().catch((error) => {
      console.error('[nearbuy:preview-api]', error)
      if (!res.headersSent) send(res, 400, undefined, 'Please check your request and try again.')
    })
  }
}
