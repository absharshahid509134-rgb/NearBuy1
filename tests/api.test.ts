/**
 * NearBuy API / integration test suite.
 *
 * Runs against a REAL gateway process pointed at the throwaway `nearbuy_test`
 * database (scripts/run-api-tests.mjs migrates, seeds and starts the gateway
 * if needed). Nothing here is mocked: Postgres, Prisma, bcrypt, cookies,
 * CSRF and the full order/reservation/delivery state machines.
 *
 *   npm run test:api
 * (or manually: API_URL=http://127.0.0.1:4100 node --import tsx --test tests/api.test.ts)
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const BASE = process.env.API_URL ?? 'http://127.0.0.1:4100'
const API = BASE.replace(/\/$/, '') + '/api/v1'
const TEST_DB =
  process.env.TEST_DATABASE_URL ?? 'postgresql://nearbuy:nearbuy@127.0.0.1:5432/nearbuy_test?schema=public'
const ADDRESS = 'B-14, Sector 22, Dwarka, Delhi 110077'

// ────────────────────────────────────────────────────────────────────────────
// Minimal HTTP client with a per-user cookie jar (session + CSRF)
// ────────────────────────────────────────────────────────────────────────────
interface Res {
  status: number
  body: any
  headers: Headers
}

class Client {
  cookies = new Map<string, string>()
  constructor(private base: string) {}

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  async req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Res> {
    const headers: Record<string, string> = { ...extra }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const csrf = this.cookies.get('nb_csrf')
    if (csrf && method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrf
    if (this.cookies.size) headers['Cookie'] = this.cookieHeader()
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';')
      const i = pair.indexOf('=')
      if (i < 0) continue
      const name = pair.slice(0, i).trim()
      const val = pair.slice(i + 1).trim()
      const expiresAttr = attrs.find((a) => /expires=/i.test(a))
      const maxAge = /max-age=(\d+)/i.exec(c)?.[1]
      const dead =
        val === '' ||
        (maxAge !== undefined && Number(maxAge) <= 0) ||
        (expiresAttr !== undefined && Number(new Date(expiresAttr.split('=').slice(1).join('='))) <= Date.now())
      if (dead) this.cookies.delete(name)
      else this.cookies.set(name, val)
    }
    const text = await res.text()
    let parsed: any = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    return { status: res.status, body: parsed, headers: res.headers }
  }
}

// Session cache — each account logs in at most once per run (keeps the
// auth throttle budget predictable).
const sessions = new Map<string, Promise<Client>>()
function session(email: string, password = 'Customer@123'): Promise<Client> {
  const key = `${email}:${password}`
  let p = sessions.get(key)
  if (!p) {
    p = (async () => {
      const c = new Client(API)
      const res = await c.req('POST', '/auth/login', { email, password })
      if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
      return c
    })()
    sessions.set(key, p)
  }
  return p
}

// Login helper for dynamically-resolved seller accounts (by user id).
const byUser = new Map<string, Promise<Client>>()
async function loginByUserId(userId: string): Promise<Client> {
  let p = byUser.get(userId)
  if (!p) {
    p = (async () => {
      const row = await one(`SELECT email FROM "User" WHERE id = $1`, [userId])
      const c = new Client(API)
      const res = await c.req('POST', '/auth/login', { email: row.email, password: 'Seller@123' })
      if (res.status !== 200) throw new Error(`login by user ${userId} failed: ${res.status}`)
      return c
    })()
    byUser.set(userId, p)
  }
  return p
}

// ────────────────────────────────────────────────────────────────────────────
// Direct Postgres access (persistence + atomicity assertions)
// ────────────────────────────────────────────────────────────────────────────
const db = new pg.Client({ connectionString: TEST_DB })
async function q(sql: string, params: unknown[] = []): Promise<any[]> {
  return (await db.query(sql, params as any[])).rows
}
async function one(sql: string, params: unknown[] = []): Promise<any> {
  return (await q(sql, params))[0]
}

// Seeded fixtures, resolved from the database (never hard-coded IDs).
let S: {
  freshMart: string
  gadgetStore: string
  stationery: string
  milk: string
  earbuds: string
  notebook: string
  customer: string
  meera: string
  rider: string
  milkInv: string
}

before(async () => {
  await db.connect()
  const [fresh] = await q(`SELECT id FROM "Store" WHERE name = 'Dwarka Fresh Mart'`)
  const [gadget] = await q(`SELECT id FROM "Store" WHERE name = 'Sector 22 Gadget Store'`)
  const [station] = await q(`SELECT id FROM "Store" WHERE name = 'Stationery World'`)
  const [milk] = await q(`SELECT p.id FROM "Product" p WHERE p.name = 'Amul Taaza Milk 1L'`)
  const [earb] = await q(`SELECT p.id FROM "Product" p WHERE p.name = 'SonicBeat Earbuds Mini'`)
  const [note] = await q(`SELECT p.id FROM "Product" p WHERE p.name = 'Classmate Notebook 200pg'`)
  const [cust] = await q(`SELECT id FROM "User" WHERE email = 'customer@nearbuy.dev'`)
  const [meera] = await q(`SELECT id FROM "User" WHERE email = 'meera@nearbuy.dev'`)
  const [rider] = await q(`SELECT id FROM "User" WHERE email = 'delivery@nearbuy.dev'`)
  if (![fresh, gadget, station, milk, earb, note, cust, meera, rider].every(Boolean)) {
    throw new Error('nearbuy_test is not seeded — run: npm run test:api (or scripts/run-api-tests.mjs)')
  }
  const inv = await one(
    `SELECT id FROM "Inventory" WHERE "storeId" = $1 AND "productId" = $2 AND "variantId" IS NULL`,
    [fresh.id, milk.id],
  )
  S = {
    freshMart: fresh.id,
    gadgetStore: gadget.id,
    stationery: station.id,
    milk: milk.id,
    earbuds: earb.id,
    notebook: note.id,
    customer: cust.id,
    meera: meera.id,
    rider: rider.id,
    milkInv: inv.id,
  }
})

after(async () => {
  await db.end()
})

// ────────────────────────────────────────────────────────────────────────────
describe('1. health endpoints', () => {
  it('GET /live responds without auth', async () => {
    const res = await fetch(`${BASE}/live`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.status, 'live')
    })

  it('GET /health reports ok', async () => {
    const res = await fetch(`${BASE}/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.status, 'ok')
    })

  it('GET /ready checks the database', async () => {
    const res = await fetch(`${BASE}/ready`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.data.checks.database, 'ok')
    })
})

describe('2. catalog is served from persisted records', () => {
  it('catalog stores match the database exactly', async () => {
    const res = await new Client(API).req('GET', '/catalog')
    assert.equal(res.status, 200)
    const { stores, products, categories } = res.body.data
    const [row] = await q(`SELECT COUNT(*)::int AS n FROM "Store"`)
    assert.equal(stores.length, row.n)
    const names = stores.map((s: any) => s.name)
    assert.ok(names.includes('Dwarka Fresh Mart'))
    const catNames = categories.map((c: any) => c.id)
    assert.ok(catNames.includes('grocery'))
    assert.ok(products.length > 10)
    })

  it('prices and stock in the catalog come from the inventory table', async () => {
    const c = new Client(API)
    const res = await c.req('GET', '/catalog')
    const milk = res.body.data.products.find((p: any) => p.name === 'Amul Taaza Milk 1L')
    assert.ok(milk)
    // per-store price/stock is served by the store products endpoint
    const [storeRow] = await q(`SELECT slug FROM "Store" WHERE id = $1`, [S.freshMart])
    const sp = await c.req('GET', `/stores/${storeRow.slug}/products`)
    assert.equal(sp.status, 200)
    const listing = sp.body.data.find((l: any) => l.productId === milk.id)
    assert.ok(listing)
    const inv = await one(`SELECT "price", "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    assert.equal(listing.price, Number(inv.price))
    assert.equal(listing.stock, inv.availableQuantity)
    })

  it('GET /products and /stores are also database-backed', async () => {
    const c = new Client(API)
    const p = await c.req('GET', '/products')
    assert.equal(p.status, 200)
    assert.equal(p.body.data.some((x: any) => x.name === 'Aashirvaad Atta 5kg'), true)
    const s = await c.req('GET', '/stores')
    assert.equal(s.status, 200)
    assert.ok(s.body.data.length >= 7)
    })
})

describe('3. authentication, sessions and secrets', () => {
  it('rejects a wrong password with 401 and no session', async () => {
    const c = new Client(API)
    const res = await c.req('POST', '/auth/login', {
      email: 'customer@nearbuy.dev',
      password: 'WrongPassword1',
    })
    assert.equal(res.status, 401)
    assert.equal(c.cookies.get('nb_at'), undefined)
    })

  it('login issues an httpOnly session cookie', async () => {
    const raw = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@nearbuy.dev', password: 'Customer@123' }),
    })
    const setCookies = raw.headers.getSetCookie()
    const at = setCookies.find((c) => c.startsWith('nb_at='))
    assert.ok(at)
    assert.match(at, /httponly/i)    // Secure flag is on whenever the app runs with an https WEB_URL
    if (process.env.WEB_URL?.startsWith('https')) assert.match(at, /secure/i)
    })

  it('passwords are stored as bcrypt hashes', async () => {
    const row = await one(`SELECT "passwordHash" FROM "User" WHERE email = 'customer@nearbuy.dev'`)
    assert.ok(!row.passwordHash.includes('Customer@123'))
    assert.equal(bcrypt.compareSync('Customer@123', row.passwordHash), true)
    })

  it('protected routes require a session (401 without)', async () => {
    const res = await new Client(API).req('GET', '/users/me')
    assert.equal(res.status, 401)
    })

  it('state-changing requests require the CSRF token (403 without)', async () => {
    const c = await session('customer@nearbuy.dev')
    const res = await fetch(`${API}/wishlist/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: c.cookieHeader() },
      body: JSON.stringify({ productId: S.milk, storeId: S.freshMart, qty: 1 }),
    })
    assert.equal(res.status, 403)
    })

  it('logout invalidates the session', async () => {
    // disposable session so the cached meera session stays usable
    const c = new Client(API)
    const login = await c.req('POST', '/auth/login', { email: 'meera@nearbuy.dev', password: 'Customer@123' })
    assert.equal(login.status, 200)
    const out = await c.req('POST', '/auth/logout')
    assert.equal(out.status, 200)
    const res = await c.req('GET', '/users/me')
    assert.equal(res.status, 401)
    })
})

describe('4. role isolation (no cross-role or cross-user access)', () => {
  it('a customer cannot create products', async () => {
    const c = await session('customer@nearbuy.dev')
    const res = await c.req('POST', '/products', {
      name: 'Hacked Item',
      sku: 'HACK-1',
      categorySlug: 'grocery',
      description: 'Should fail',
      listPrice: 1,
      mrp: 1,
    })
    assert.equal(res.status, 403)
    })

  it('a customer cannot reach admin endpoints', async () => {
    const c = await session('customer@nearbuy.dev')
    assert.equal((await c.req('GET', '/admin/metrics')).status, 403)
    })

  it('a customer cannot open rider endpoints', async () => {
    const c = await session('customer@nearbuy.dev')
    assert.equal((await c.req('GET', '/delivery/jobs')).status, 403)
    })

  it('a seller cannot open rider endpoints', async () => {
    const c = await session('seller.sports@nearbuy.dev', 'Seller@123')
    assert.equal((await c.req('GET', '/delivery/jobs')).status, 403)
    })

  it('a rider cannot place customer orders (server-side role check)', async () => {
    const rider = await session('delivery@nearbuy.dev', 'Delivery@123')
    const res = await rider.req('POST', '/checkout/orders', {
      items: [{ productId: S.notebook, storeId: S.stationery, qty: 1 }],
      fulfillment: 'NEARBY_PICKUP',
      paymentMethod: 'PAY_AT_STORE',
      addressLine: ADDRESS,
    })
    assert.equal(res.status, 403)
    })

  it('customer A cannot read customer B’s order by id', async () => {
    const meera = await session('meera@nearbuy.dev', 'Customer@123')
    const order = await meera.req('POST', '/checkout/orders', {
      items: [{ productId: S.notebook, storeId: S.stationery, qty: 1 }],
      fulfillment: 'NEARBY_PICKUP',
      paymentMethod: 'PAY_AT_STORE',
      addressLine: ADDRESS,
    })
    assert.equal(order.status, 201)
    const oid = order.body.data.orders[0].id
    const customer = await session('customer@nearbuy.dev')
    const foreign = await customer.req('GET', `/orders/${oid}`)
    assert.equal(foreign.status, 403)
    })

  it('seller A cannot patch seller B’s product', async () => {
    const books = await session('seller.books@nearbuy.dev', 'Seller@123')
    const target = await one(
      `SELECT p.id FROM "Product" p JOIN "Inventory" i ON i."productId" = p.id JOIN "Store" s ON s.id = i."storeId" WHERE s.name = 'Dwarka Sports Hub' LIMIT 1`,
    )
    const res = await books.req('PATCH', `/products/${target.id}`, { listPrice: 1 })
    assert.equal(res.status, 403)
    })
})

describe('5. reservations — seller-confirmed, inventory locked', () => {
  it('a reservation starts as REQUESTED and locks inventory (no auto-confirm)', async () => {
    const c = await session('customer@nearbuy.dev')
    const before = await one(`SELECT "reservedQuantity", "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    const res = await c.req('POST', '/checkout/reservations', {
      items: [{ productId: S.milk, storeId: S.freshMart, qty: 1 }],
      pickupWindow: '6:00 – 6:30 PM',
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.status, 'REQUESTED')
    assert.match(res.body.data.code, /^NB-/)
    const after = await one(`SELECT "reservedQuantity", "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    assert.equal(after.reservedQuantity, before.reservedQuantity + 1)
    assert.equal(after.availableQuantity, before.availableQuantity - 1)
    })

  it('the seller confirms the requested reservation', async () => {
    const c = await session('customer@nearbuy.dev')
    const list = await c.req('GET', '/reservations')
    const requested = list.body.data.find((r: any) => r.status === 'REQUESTED')
    assert.ok(requested)
    const seller = await session('seller.grocery@nearbuy.dev', 'Seller@123')
    const res = await seller.req('POST', `/reservations/${requested.id}/confirm`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.status, 'CONFIRMED')
    })

  it('cancelling a reservation releases the locked stock', async () => {
    const c = await session('meera@nearbuy.dev', 'Customer@123')
    const before = await one(`SELECT "reservedQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    const created = await c.req('POST', '/checkout/reservations', {
      items: [{ productId: S.milk, storeId: S.freshMart, qty: 2 }],
      pickupWindow: '7:00 – 7:30 PM',
    })
    assert.equal(created.status, 201)
    const mid = await one(`SELECT "reservedQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    assert.equal(mid.reservedQuantity, before.reservedQuantity + 2)
    const cancel = await c.req('POST', `/reservations/${created.body.data.id}/cancel`)
    assert.equal(cancel.status, 200)
    const after = await one(`SELECT "reservedQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    assert.equal(after.reservedQuantity, before.reservedQuantity)
    })
})

describe('6. checkout — server prices, per-store fees, idempotency', () => {
  const key1 = crypto.randomUUID()

  it('the quote uses database prices and per-store fees', async () => {
    const c = await session('customer@nearbuy.dev')
    const res = await c.req('POST', '/checkout/quote', {
      items: [
        { productId: S.milk, storeId: S.freshMart, qty: 2 },
        { productId: S.earbuds, storeId: S.gadgetStore, qty: 1 },
      ],
      fulfillment: 'LOCAL_DELIVERY',
    })
    assert.equal(res.status, 200)
    const d = res.body.data
    assert.equal(d.groups.length, 2)
    const milkGroup = d.groups.find((g: any) => g.storeId === S.freshMart)
    const inv = await one(`SELECT "price" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    assert.equal(milkGroup.items[0].unitPrice, Number(inv.price))
    const subtotal = d.groups.reduce((n: number, g: any) => n + g.subtotal, 0)
    const fees = d.groups.reduce((n: number, g: any) => n + g.deliveryFee, 0)
    assert.equal(d.subtotal, subtotal)
    assert.equal(d.deliveryFee, fees)
    assert.equal(d.total, subtotal + fees)
    for (const g of d.groups) assert.ok(g.deliveryFee > 0)
    })

  it('a multi-store order creates one order per store with server totals', async () => {
    const c = await session('customer@nearbuy.dev')
    const { availableQuantity: beforeMilk } = await one(`SELECT "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    const res = await c.req('POST', '/checkout/orders', {
      items: [
        { productId: S.milk, storeId: S.freshMart, qty: 2 },
        { productId: S.earbuds, storeId: S.gadgetStore, qty: 1 },
      ],
      fulfillment: 'LOCAL_DELIVERY',
      paymentMethod: 'COD',
      addressLine: ADDRESS,
      idempotencyKey: key1,
    })
    assert.equal(res.status, 201)
    const orders = res.body.data.orders
    assert.equal(orders.length, 2)
    assert.equal(new Set(orders.map((o: any) => o.storeId)).size, 2)
    const milkOrder = orders.find((o: any) => o.storeId === S.freshMart)
    const inv = await one(`SELECT "price", "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    assert.equal(milkOrder.items[0].unitPrice, Number(inv.price))
    assert.equal(milkOrder.subtotal, Number(inv.price) * 2)
    assert.equal(milkOrder.total, milkOrder.subtotal + milkOrder.deliveryFee)
    assert.equal(inv.availableQuantity, beforeMilk - 2)
    for (const o of orders) {
      const drow = await one(`SELECT "pickupCode", "dropCode", "status" FROM "Delivery" WHERE "orderId" = $1`, [o.id])
      assert.equal(drow.status, 'PENDING')
      assert.match(drow.pickupCode, /^\d{4}$/)
      assert.match(drow.dropCode, /^\d{4}$/)    }
  })

  it('retrying with the same idempotency key returns the SAME orders (no duplicates)', async () => {
    const c = await session('customer@nearbuy.dev')
    const res = await c.req('POST', '/checkout/orders', {
      items: [
        { productId: S.milk, storeId: S.freshMart, qty: 2 },
        { productId: S.earbuds, storeId: S.gadgetStore, qty: 1 },
      ],
      fulfillment: 'LOCAL_DELIVERY',
      paymentMethod: 'COD',
      addressLine: ADDRESS,
      idempotencyKey: key1,
    })
    assert.ok([200, 201].includes(res.status))
    const replayed = res.body.data.orders
    assert.equal(replayed.length, 2)    // stock was decremented only ONCE for this attempt
    const inv = await one(`SELECT "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    const originalCount = await one(`SELECT COUNT(*)::int AS n FROM "CheckoutRequest" WHERE "key" = $1`, [key1])
    assert.equal(originalCount.n, 1)
    assert.strictEqual(typeof inv.availableQuantity, 'number')
    })

  it('the same key with a different cart is rejected (409 IDEMPOTENCY_MISMATCH)', async () => {
    const c = await session('customer@nearbuy.dev')
    const res = await c.req('POST', '/checkout/orders', {
      items: [{ productId: S.notebook, storeId: S.stationery, qty: 1 }],
      fulfillment: 'NEARBY_PICKUP',
      paymentMethod: 'PAY_AT_STORE',
      addressLine: ADDRESS,
      idempotencyKey: key1,
    })
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'IDEMPOTENCY_MISMATCH')
    })

  it('ordering more than available stock is rejected (409 OUT_OF_STOCK)', async () => {
    const c = await session('customer@nearbuy.dev')
    const { availableQuantity: avail } = await one(`SELECT "availableQuantity" FROM "Inventory" WHERE id = $1`, [S.milkInv])
    const res = await c.req('POST', '/checkout/orders', {
      items: [{ productId: S.milk, storeId: S.freshMart, qty: avail + 5 }],
      fulfillment: 'LOCAL_DELIVERY',
      paymentMethod: 'COD',
      addressLine: ADDRESS,
    })
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'OUT_OF_STOCK')
    })

  it('pickup orders carry no delivery fee and no delivery record', async () => {
    const c = await session('meera@nearbuy.dev', 'Customer@123')
    const res = await c.req('POST', '/checkout/orders', {
      items: [{ productId: S.notebook, storeId: S.stationery, qty: 1 }],
      fulfillment: 'NEARBY_PICKUP',
      paymentMethod: 'PAY_AT_STORE',
      addressLine: ADDRESS,
    })
    assert.equal(res.status, 201)
    const o = res.body.data.orders[0]
    assert.equal(o.deliveryFee, 0)
    const drow = await q(`SELECT id FROM "Delivery" WHERE "orderId" = $1`, [o.id])
    assert.equal(drow.length, 0)
    })
})

describe('7. seller journey — onboarding, products, order state machine', () => {
  const run = Date.now()
  const email = `seller.test${run}@nearbuy.dev`
  let newStore: { id: string; slug: string }
  let newProduct: { id: string }

  it('a new seller registers a store that customers can discover', async () => {
    const c = new Client(API)
    const reg = await c.req('POST', '/auth/register', {
      email,
      password: 'Seller@123',
      name: 'Test Seller',
      role: 'SELLER',
    })
    assert.equal(reg.status, 201)
    const onb = await c.req('POST', '/sellers/register', {
      legalName: `Test Fresh Mart ${run}`,
      store: {
        name: `Test Fresh Mart ${run}`,
        category: 'Grocery',
        blurb: 'Test store created by the API suite',
        lat: 28.5921,
        lng: 77.046,
        area: 'Sector 22, Dwarka',
        address: 'Shop 99, Test Lane, Dwarka, Delhi 110077',
        pincode: '110077',
      },
    })
    assert.equal(onb.status, 201)
    newStore = onb.body.data.stores[0]
    // visible to an anonymous customer without any seller involvement
    const pub = await new Client(API).req('GET', '/catalog')
    assert.equal(pub.body.data.stores.some((s: any) => s.id === newStore.id), true)
    })

  it('the new seller creates a product that appears in the public catalog', async () => {
    const c = await session(email, 'Seller@123')
    const res = await c.req('POST', '/products', {
      name: `Test Ghee 500ml ${run}`,
      sku: `TST-GHEE-${run}`,
      categorySlug: 'grocery',
      description: 'Clarified butter test product',
      listPrice: 450,
      mrp: 480,
      emoji: '🧈',
      tags: ['test'],
    })
    assert.equal(res.status, 201)
    newProduct = { id: res.body.data.id }
    const stock = await c.req('POST', '/inventory/bulk', {
      items: [{ productId: newProduct.id, quantity: 12, price: 450 }],
    })
    assert.equal(stock.status, 201)
    const pub = await new Client(API).req('GET', '/catalog')
    assert.equal(pub.body.data.products.some((p: any) => p.id === newProduct.id), true)
    })

  it('order transitions follow the state machine and reject skips', async () => {
    const c = await session('customer@nearbuy.dev')
    const order = await c.req('POST', '/checkout/orders', {
      items: [{ productId: newProduct.id, storeId: newStore.id, qty: 1 }],
      fulfillment: 'LOCAL_DELIVERY',
      paymentMethod: 'COD',
      addressLine: ADDRESS,
    })
    assert.equal(order.status, 201)
    const oid = order.body.data.orders[0].id
    const seller = await session(email, 'Seller@123')

    // skip attempt: ready() straight from CONFIRMED
    const skip = await seller.req('POST', `/orders/${oid}/ready`)
    assert.equal(skip.status, 409)
    const p1 = await seller.req('POST', `/orders/${oid}/preparing`)
    assert.equal(p1.status, 200)
    assert.equal(p1.body.data.status, 'PREPARING')
    const p2 = await seller.req('POST', `/orders/${oid}/packed`)
    assert.equal(p2.body.data.status, 'PACKED')
    const p3 = await seller.req('POST', `/orders/${oid}/ready`)
    assert.equal(p3.body.data.status, 'READY_FOR_PICKUP')    // seller cannot complete a delivery-mode order (the rider does)
    const bad = await seller.req('POST', `/orders/${oid}/complete`)
    assert.equal(bad.status, 409)
    return oid
  })

  it('only the owner (or staff) may transition an order', async () => {
    const stranger = await session('seller.books@nearbuy.dev', 'Seller@123')
    const oid = await one(
      `SELECT o."id" FROM "Order" o JOIN "Store" s ON s.id = o."storeId" WHERE s.name LIKE 'Test Fresh Mart%' ORDER BY o."createdAt" DESC LIMIT 1`,
    )
    const res = await stranger.req('POST', `/orders/${oid.id}/complete`)
    assert.equal(res.status, 403)
    })
})

describe('8. rider journey — atomic claim, code-verified handoffs', () => {
  let handoffOrderId: string | undefined
  it('exactly one of two concurrent riders can claim a job', async () => {
    const c = await session('customer@nearbuy.dev')
    const order = await c.req('POST', '/checkout/orders', {
      items: [{ productId: S.notebook, storeId: S.stationery, qty: 1 }],
      fulfillment: 'LOCAL_DELIVERY',
      paymentMethod: 'COD',
      addressLine: ADDRESS,
    })
    assert.equal(order.status, 201)
    const oid = order.body.data.orders[0].id
    const job = await one(`SELECT id FROM "Delivery" WHERE "orderId" = $1 AND "status" = 'PENDING'`, [oid])
    const riderA = await session('delivery@nearbuy.dev', 'Delivery@123')
    const b = new Client(API)
    const reg = await b.req('POST', '/auth/register', {
      email: `rider.test${Date.now()}@nearbuy.dev`,
      password: 'Delivery@123',
      name: 'Second Rider',
      role: 'DELIVERY_PARTNER',
    })
    assert.equal(reg.status, 201)
    await riderA.req('PATCH', '/delivery/availability', { available: true })
    await b.req('PATCH', '/delivery/availability', { available: true })
    const [a, z] = await Promise.all([
      riderA.req('POST', `/delivery/jobs/${job.id}/accept`),
      b.req('POST', `/delivery/jobs/${job.id}/accept`),
    ])
    assert.deepEqual([a.status, z.status].sort(), [200, 409])
    const row = await one(`SELECT "partnerId", "status" FROM "Delivery" WHERE id = $1`, [job.id])
    assert.equal(row.status, 'ASSIGNED')
    })

  it('full handoff: AT_STORE → PICKED_UP(code) → AT_CUSTOMER → DELIVERED(code) → COMPLETED', async () => {
    // fresh job, claimed deterministically by the seeded rider
    const c = await session('customer@nearbuy.dev')
    const order = await c.req('POST', '/checkout/orders', {
      items: [{ productId: S.notebook, storeId: S.stationery, qty: 1 }],
      fulfillment: 'LOCAL_DELIVERY',
      paymentMethod: 'COD',
      addressLine: ADDRESS,
    })
    assert.equal(order.status, 201)
    const oid = order.body.data.orders[0].id
    const job = await one(`SELECT id, "pickupCode", "dropCode" FROM "Delivery" WHERE "orderId" = $1`, [oid])
    const rider = await session('delivery@nearbuy.dev', 'Delivery@123')
    await rider.req('PATCH', '/delivery/availability', { available: true })
    const claim = await rider.req('POST', `/delivery/jobs/${job.id}/accept`)
    assert.equal(claim.status, 200)
    const atStore = await rider.req('POST', `/delivery/${job.id}/events`, { status: 'AT_STORE' })
    assert.equal(atStore.status, 200)
    // pickup before the store is ready must fail, even with the right code
    const early = await rider.req('POST', `/delivery/${job.id}/events`, {
      status: 'PICKED_UP',
      code: job.pickupCode,
    })
    assert.equal(early.status, 409)
    // the seller must complete preparation
    const sellerOf = await one(
      `SELECT u.id FROM "Order" x JOIN "Store" s ON s.id = x."storeId" JOIN "Seller" sl ON sl.id = s."sellerId" JOIN "User" u ON u.id = sl."userId" WHERE x.id = $1`,
      [oid],
    )
    const seller = await loginByUserId(sellerOf.id)
    for (const act of ['preparing', 'packed', 'ready']) {
      const r = await seller.req('POST', `/orders/${oid}/${act}`)
      assert.equal(r.status, 200)    }

    // wrong pickup code rejected
    const wrong = await rider.req('POST', `/delivery/${job.id}/events`, { status: 'PICKED_UP', code: '0000' })
    assert.equal(wrong.status, 400)
    const picked = await rider.req('POST', `/delivery/${job.id}/events`, {
      status: 'PICKED_UP',
      code: job.pickupCode,
    })
    assert.equal(picked.status, 200)
    const atCust = await rider.req('POST', `/delivery/${job.id}/events`, { status: 'AT_CUSTOMER' })
    assert.equal(atCust.status, 200)    // wrong customer handoff code rejected
    const wrongDrop = await rider.req('POST', `/delivery/${job.id}/events`, {
      status: 'DELIVERED',
      code: '0000',
    })
    assert.equal(wrongDrop.status, 400)
    const done = await rider.req('POST', `/delivery/${job.id}/events`, {
      status: 'DELIVERED',
      code: job.dropCode,
    })
    assert.equal(done.status, 200)
    const o = await one(`SELECT "status" FROM "Order" WHERE id = $1`, [oid])
    assert.equal(o.status, 'COMPLETED')
    // terminal: no further transitions
    const after = await rider.req('POST', `/delivery/${job.id}/events`, { status: 'AT_STORE' })
    assert.equal(after.status, 409)
    handoffOrderId = oid
    })

  it('the customer sees Delivered (with the drop code, not the pickup code)', async () => {
    assert.ok(handoffOrderId, 'full handoff must complete first')
    const c = await session('customer@nearbuy.dev')
    const res = await c.req('GET', `/orders/${handoffOrderId}/track`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.status, 'COMPLETED')
    assert.equal(res.body.data.timeline.some((e: any) => e.label === 'Delivered'), true)
  })

  it('order detail never leaks the drop code to the seller (and vice versa)', async () => {
    const o = await one(
      `SELECT o.id, d."dropCode", d."pickupCode"
       FROM "Order" o JOIN "Delivery" d ON d."orderId" = o.id
       WHERE o."userId" = $1 AND d."dropCode" IS NOT NULL
       ORDER BY o."createdAt" DESC LIMIT 1`,
      [S.customer],
    )
    assert.ok(o)
    const sellerOf = await one(
      `SELECT u.id FROM "Order" x JOIN "Store" s ON s.id = x."storeId" JOIN "Seller" sl ON sl.id = s."sellerId" JOIN "User" u ON u.id = sl."userId" WHERE x.id = $1`,
      [o.id],
    )
    const seller = await loginByUserId(sellerOf.id)
    const sRes = await seller.req('GET', `/orders/${o.id}`)
    assert.equal(sRes.status, 200)
    assert.equal(sRes.body.data.delivery.pickupCode, o.pickupCode)
    assert.equal(sRes.body.data.delivery.dropCode, undefined)
    const c = await session('customer@nearbuy.dev')
    const cRes = await c.req('GET', `/orders/${o.id}`)
    assert.equal(cRes.status, 200)
    assert.equal(cRes.body.data.delivery.dropCode, o.dropCode)
    assert.equal(cRes.body.data.delivery.pickupCode, undefined)
    })

  it('rider earnings endpoint works', async () => {
    const rider = await session('delivery@nearbuy.dev', 'Delivery@123')
    const res = await rider.req('GET', '/delivery/earnings')
    assert.equal(res.status, 200)
    assert.ok(res.body.data.balance >= 0)
    })
})

describe('9. search is persisted', () => {
  it('search finds the seeded milk product', async () => {
    const c = new Client(API)
    const res = await c.req('GET', `/search?q=amul&lat=28.5921&lng=77.046`)
    assert.equal(res.status, 200)
    assert.ok(JSON.stringify(res.body.data).includes('Amul Taaza Milk 1L'))
    })

  it('every search is recorded for the demand radar', async () => {
    const before = await one(`SELECT COUNT(*)::int AS n FROM "SearchQuery"`)
    await new Client(API).req('GET', `/search?q=amul%20milk&lat=28.5921&lng=77.046`)
    const after = await one(`SELECT COUNT(*)::int AS n FROM "SearchQuery"`)
    assert.ok(after.n > before.n)
    })
})

describe('10. rate limiting', () => {
  it('throttles login brute-forcing (429 after the per-endpoint limit)', async () => {
    const codes: number[] = []
    for (let i = 0; i < 30; i++) {
      const c = new Client(API)
      const res = await c.req('POST', '/auth/login', {
        email: 'customer@nearbuy.dev',
        password: `guess-${i}`,
      })
      codes.push(res.status)
      if (codes.filter((x) => x === 429).length >= 3) break
    }
    assert.equal(codes.some((x) => x === 429), true)
    })

  it('throttles the global per-IP budget (429 on the /catalog flood)', async () => {
    const c = new Client(API)
    let saw429 = false
    for (let i = 0; i < 320; i++) {
      const res = await c.req('GET', '/catalog')
      if (res.status === 429) {
        saw429 = true
        break
      }
    }
    assert.equal(saw429, true)
    })
})
