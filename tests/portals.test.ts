import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { after, before, test } from 'node:test'
import { demoApi } from '../scripts/demo-api'
import { canAccess, homeForUser, portalForRole, safeReturnTo } from '../src/auth/portals'
import { registerSchema } from '../packages/validation/src/index'

let server: Server
let origin: string
before(async () => {
  const middleware = demoApi()
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404
      res.end()
    }),
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

type Session = { cookies: string; csrf: string }
async function request(path: string, method = 'GET', session?: Session, body?: unknown) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Cookie: session.cookies, 'X-CSRF-Token': session.csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = (await response.json()) as { success: boolean; data?: any; error?: { message: string } }
  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  return { status: response.status, result, cookies }
}
async function login(email: string, password: string) {
  const response = await request('/auth/login', 'POST', undefined, { email, password })
  assert.equal(response.status, 200)
  const csrf = response.cookies.match(/nb_csrf=([^; ]+)/)?.[1]
  assert.ok(csrf, 'CSRF cookie was set')
  return { session: { cookies: response.cookies, csrf }, role: response.result.data.user.role as string }
}

test('portal roles and safe return URLs follow the server-assigned role', () => {
  const customer = { id: 'c', role: 'CUSTOMER' as const, name: 'Buyer' }
  const seller = { id: 's', role: 'SELLER' as const, name: 'Seller' }
  const rider = { id: 'r', role: 'DELIVERY_PARTNER' as const, name: 'Rider' }
  for (const [user, portal] of [
    [customer, 'customer'],
    [seller, 'seller'],
    [rider, 'rider'],
  ] as const) {
    assert.equal(canAccess(user, portal), true)
    assert.equal(homeForUser(user), portal === 'customer' ? '/customer' : `/${portal}`)
    for (const other of ['customer', 'seller', 'rider'] as const)
      if (other !== portal) assert.equal(canAccess(user, other), false)
  }
  for (const role of ['SELLER_EMPLOYEE', 'STORE_STAFF', 'FINANCE_ADMIN'] as const) {
    const staff = { id: 'u', name: 'Staff', role }
    assert.equal(portalForRole(role), null, `${role} needs its own supported workspace`)
    assert.equal(homeForUser(staff), '/unavailable')
    assert.equal(canAccess(staff, 'seller'), false)
    assert.equal(canAccess(staff, 'admin'), false)
  }
  assert.equal(safeReturnTo('/seller/inventory', 'seller'), '/seller/inventory')
  assert.equal(safeReturnTo('/rider/jobs', 'customer'), '/customer')
  assert.equal(safeReturnTo('//evil.example/path', 'seller'), '/seller')
  assert.equal(safeReturnTo('/admin/radar', 'rider'), '/rider')
  assert.equal(
    registerSchema.safeParse({
      name: 'Attacker',
      email: 'a@example.com',
      password: 'safePassword1',
      role: 'FINANCE_ADMIN',
    }).success,
    false,
  )
  assert.equal(
    registerSchema.safeParse({
      name: 'Rider',
      email: 'r@example.com',
      password: 'safePassword1',
      role: 'DELIVERY_PARTNER',
    }).success,
    true,
  )
})

test("three separate sign-ins cannot access another role's server data", async () => {
  assert.equal((await request('/auth/me')).status, 401)
  assert.equal((await request('/delivery/jobs')).status, 401)
  assert.equal((await request('/sellers/me')).status, 401)
  assert.equal(
    (await request('/auth/login', 'POST', undefined, { email: 'customer@nearbuy.dev', password: 'wrong' }))
      .status,
    401,
  )
  assert.equal(
    (
      await request('/auth/register', 'POST', undefined, {
        name: 'Intruder',
        email: 'intruder@example.com',
        password: 'safePassword1',
        role: 'ADMIN',
      })
    ).status,
    400,
  )

  const buyer = await login('customer@nearbuy.dev', 'Customer@123')
  assert.equal(buyer.role, 'CUSTOMER')
  assert.equal((await request('/sellers/me', 'GET', buyer.session)).status, 403)
  assert.equal((await request('/delivery/jobs', 'GET', buyer.session)).status, 403)
  assert.equal(
    (
      await request('/sellers/register', 'POST', buyer.session, {
        legalName: 'Intruder',
        store: { name: 'Fake' },
      })
    ).status,
    403,
  )

  const seller = await login('seller.sports@nearbuy.dev', 'Seller@123')
  assert.equal(seller.role, 'SELLER')
  assert.equal((await request('/delivery/jobs', 'GET', seller.session)).status, 403)
  assert.equal((await request('/sellers/me', 'GET', seller.session)).result.data.stores[0].name, 'ABC Sports')
  assert.equal((await request('/inventory', 'GET', seller.session)).result.data.length, 5)
  assert.equal(
    (
      await request(
        '/inventory/bulk',
        'POST',
        { ...seller.session, csrf: 'wrong' },
        { source: 'MANUAL', items: [] },
      )
    ).status,
    403,
  )

  const rider = await login('delivery@nearbuy.dev', 'Delivery@123')
  assert.equal(rider.role, 'DELIVERY_PARTNER')
  assert.equal((await request('/sellers/me', 'GET', rider.session)).status, 403)
  assert.equal((await request('/delivery/jobs', 'GET', rider.session)).result.data.available.length, 2)

  const logout = await request('/auth/logout', 'POST', buyer.session)
  assert.equal(logout.status, 200)
  assert.equal((await request('/auth/me', 'GET', buyer.session)).status, 401)
})

test('sellers advance a reservation through the correct handoff sequence', async () => {
  const seller = (await login('seller.sports@nearbuy.dev', 'Seller@123')).session
  const reservation = (await request('/reservations?role=seller', 'GET', seller)).result.data[0]
  const action = (name: string) => request(`/reservations/${reservation.id}/${name}`, 'POST', seller)
  assert.equal((await action('collect')).status, 409)
  for (const [name, expected] of [
    ['confirm', 'CONFIRMED'],
    ['pack', 'PACKING'],
    ['ready', 'READY_FOR_PICKUP'],
    ['arrive', 'CUSTOMER_ARRIVED'],
    ['collect', 'COLLECTED'],
    ['complete', 'COMPLETED'],
  ]) {
    const result = await action(name)
    assert.equal(result.status, 200)
    assert.equal(result.result.data.status, expected)
  }
  assert.equal((await action('complete')).status, 409)
})

test('riders must claim their own job and verify both handoff codes', async () => {
  const rider = (await login('delivery@nearbuy.dev', 'Delivery@123')).session
  const jobs = await request('/delivery/jobs', 'GET', rider)
  const first = jobs.result.data.available[0].id as string
  const second = jobs.result.data.available[1].id as string
  assert.equal(
    (await request(`/delivery/${second}/events`, 'POST', rider, { status: 'AT_STORE' })).status,
    404,
  )
  assert.equal((await request(`/delivery/jobs/${first}/accept`, 'POST', rider)).status, 200)
  assert.equal((await request(`/delivery/jobs/${first}/accept`, 'POST', rider)).status, 409)
  assert.equal(
    (await request(`/delivery/${first}/events`, 'POST', rider, { status: 'AT_STORE' })).status,
    200,
  )
  assert.equal(
    (await request(`/delivery/${first}/events`, 'POST', rider, { status: 'PICKED_UP' })).status,
    400,
  )
  assert.equal(
    (await request(`/delivery/${first}/events`, 'POST', rider, { status: 'PICKED_UP', code: '4417' })).status,
    200,
  )
  assert.equal(
    (await request(`/delivery/${first}/events`, 'POST', rider, { status: 'AT_CUSTOMER' })).status,
    200,
  )
  assert.equal(
    (await request(`/delivery/${first}/events`, 'POST', rider, { status: 'DELIVERED', code: '0000' })).status,
    400,
  )
  assert.equal(
    (await request(`/delivery/${first}/events`, 'POST', rider, { status: 'DELIVERED', code: '8821' })).status,
    200,
  )
  const earnings = await request('/delivery/earnings', 'GET', rider)
  assert.equal(earnings.result.data.completed, 133)
  assert.equal(earnings.result.data.recent[0].order, 'NB-2409')
  assert.equal((await request('/delivery/jobs', 'GET', rider)).result.data.active.length, 0)
})

test('new seller and rider accounts land in their own onboarding/workspace', async () => {
  const email = `new.seller.${Date.now()}@nearbuy.dev`
  const response = await request('/auth/register', 'POST', undefined, {
    name: 'Mina Shop',
    email,
    password: 'MyPassword123',
    role: 'SELLER',
  })
  assert.equal(response.status, 200)
  const seller: Session = { cookies: response.cookies, csrf: response.cookies.match(/nb_csrf=([^; ]+)/)![1] }
  assert.equal((await request('/sellers/me', 'GET', seller)).status, 404)
  assert.equal((await request('/delivery/jobs', 'GET', seller)).status, 403)
  const created = await request('/sellers/register', 'POST', seller, {
    legalName: 'Mina Shop',
    store: { name: 'Mina Books', area: 'Dwarka' },
  })
  assert.equal(created.status, 200)
  assert.equal((await request('/sellers/me', 'GET', seller)).result.data.stores[0].name, 'Mina Books')

  const riderEmail = `new.rider.${Date.now()}@nearbuy.dev`
  const riderResponse = await request('/auth/register', 'POST', undefined, {
    name: 'Sam Rider',
    email: riderEmail,
    password: 'MyPassword123',
    role: 'DELIVERY_PARTNER',
  })
  assert.equal(riderResponse.status, 200)
  const rider: Session = {
    cookies: riderResponse.cookies,
    csrf: riderResponse.cookies.match(/nb_csrf=([^; ]+)/)![1],
  }
  assert.equal((await request('/delivery/performance', 'GET', rider)).result.data.deliveries, 0)
  assert.equal(
    (await request('/delivery/availability', 'PATCH', rider, { available: false })).result.data.available,
    false,
  )
  assert.equal((await request('/sellers/me', 'GET', rider)).status, 403)
})

test('customer checkout creates a seller order and a rider job with separate handoff secrets', async () => {
  const buyer = (await login('customer@nearbuy.dev', 'Customer@123')).session
  const seller = (await login('seller.sports@nearbuy.dev', 'Seller@123')).session
  const rider = (await login('delivery@nearbuy.dev', 'Delivery@123')).session
  const beforeStock = (await request('/inventory', 'GET', seller)).result.data.find((x: any) => x.productId === 'p1')
  const placed = await request('/checkout/orders', 'POST', buyer, {
    items: [{ storeId: 's1', productId: 'p1', qty: 1, unitPrice: 1 }],
    fulfillment: 'LOCAL_DELIVERY', paymentMethod: 'COD',
    addressLine: 'H-14, Sector 22, Dwarka, Delhi 110077',
  })
  assert.equal(placed.status, 200)
  const order = placed.result.data.orders[0]
  assert.equal(order.total, 1329, 'price is computed on the API, not supplied by the buyer')
  assert.equal(order.status, 'PENDING')
  assert.match(order.delivery.dropCode, /^\d{4}$/)
  assert.equal(order.delivery.pickupCode, undefined)
  const sellerOrder = (await request('/orders?role=seller', 'GET', seller)).result.data.find((x: any) => x.id === order.id)
  assert.equal(sellerOrder.number, order.number)
  assert.match(sellerOrder.delivery.pickupCode, /^\d{4}$/)
  assert.equal(sellerOrder.delivery.dropCode, undefined)
  const stockAfterCheckout = (await request('/inventory', 'GET', seller)).result.data.find((x: any) => x.productId === 'p1')
  assert.equal(stockAfterCheckout.availableQuantity, beforeStock.availableQuantity - 1)

  const jobs = await request('/delivery/jobs', 'GET', rider)
  const job = jobs.result.data.available.find((x: any) => x.number === order.number)
  assert.ok(job, 'a local delivery must create an available rider job')
  assert.equal(job.drop, 'Dwarka, Delhi', 'unassigned riders do not see the buyer address')
  assert.equal(job.pickupCode, undefined)
  assert.equal(job.dropCode, undefined)
  assert.equal((await request(`/delivery/jobs/${job.id}/accept`, 'POST', rider)).status, 200)
  const mine = (await request('/delivery/jobs', 'GET', rider)).result.data.active.find((x: any) => x.id === job.id)
  assert.match(mine.drop, /H-14/, 'the assigned rider sees the drop address')
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'AT_STORE' })).status, 200)
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'PICKED_UP', code: sellerOrder.delivery.pickupCode })).status, 409, 'rider waits for seller readiness')

  const sellerAction = (name: string) => request(`/orders/${order.id}/${name}`, 'POST', seller)
  for (const name of ['accept', 'preparing', 'packed', 'ready']) assert.equal((await sellerAction(name)).status, 200)
  assert.equal((await sellerAction('complete')).status, 409, 'delivery cannot be completed by the seller')
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'PICKED_UP', code: '0000' })).status, 400)
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'PICKED_UP', code: sellerOrder.delivery.pickupCode })).status, 200)
  const buyerOrders = (await request('/orders', 'GET', buyer)).result.data
  assert.equal(buyerOrders.find((x: any) => x.id === order.id).delivery.status, 'PICKED_UP')
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'AT_CUSTOMER' })).status, 200)
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'DELIVERED', code: '0000' })).status, 400)
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'DELIVERED', code: order.delivery.dropCode })).status, 200)
  assert.equal((await request(`/delivery/${job.id}/events`, 'POST', rider, { status: 'DELIVERED', code: order.delivery.dropCode })).status, 409)
  assert.equal((await request('/orders', 'GET', buyer)).result.data.find((x: any) => x.id === order.id).status, 'COMPLETED')
  assert.equal((await request('/orders?role=seller', 'GET', seller)).result.data.find((x: any) => x.id === order.id).status, 'COMPLETED')
  const stockAfterDelivery = (await request('/inventory', 'GET', seller)).result.data.find((x: any) => x.productId === 'p1')
  assert.equal(stockAfterDelivery.quantity, beforeStock.quantity - 1)
  assert.equal(stockAfterDelivery.reservedQuantity, beforeStock.reservedQuantity)
})

test('a reservation reaches the seller, then appears with the latest status for its buyer', async () => {
  const buyer = (await login('customer@nearbuy.dev', 'Customer@123')).session
  const seller = (await login('seller.sports@nearbuy.dev', 'Seller@123')).session
  const created = await request('/checkout/reservations', 'POST', buyer, {
    items: [{ storeId: 's1', productId: 'p2', qty: 2 }],
    pickupWindow: '6:30 – 7:00 PM',
  })
  assert.equal(created.status, 200)
  const reservation = created.result.data
  assert.equal(reservation.status, 'REQUESTED')
  assert.equal(reservation.items[0].unitPrice, 899)
  const visible = (await request('/reservations?role=seller', 'GET', seller)).result.data
  assert.equal(visible.find((x: any) => x.id === reservation.id).storeId, 'demo-store')
  const act = (name: string) => request(`/reservations/${reservation.id}/${name}`, 'POST', seller)
  for (const name of ['confirm', 'pack', 'ready']) assert.equal((await act(name)).status, 200)
  assert.equal((await request('/reservations', 'GET', buyer)).result.data.find((x: any) => x.id === reservation.id).status, 'READY_FOR_PICKUP')
  assert.equal((await request(`/reservations/${reservation.id}/cancel`, 'POST', buyer)).status, 409)
  for (const name of ['arrive', 'collect', 'complete']) assert.equal((await act(name)).status, 200)
  assert.equal((await request('/reservations', 'GET', buyer)).result.data.find((x: any) => x.id === reservation.id).status, 'COMPLETED')
  assert.equal((await request('/checkout/reservations', 'POST', seller, { items: [{ storeId: 's1', productId: 'p2', qty: 1 }], pickupWindow: '6:30 – 7:00 PM' })).status, 403)
})

test('multi-store checkout splits orders and enforces buyer ownership, price and stock', async () => {
  const buyer = (await login('customer@nearbuy.dev', 'Customer@123')).session
  const seller = (await login('seller.sports@nearbuy.dev', 'Seller@123')).session
  const strangerResponse = await request('/auth/register', 'POST', undefined, {
    name: 'Private Buyer', email: `private.buyer.${Date.now()}@nearbuy.dev`, password: 'Customer@123', role: 'CUSTOMER',
  })
  const stranger: Session = { cookies: strangerResponse.cookies, csrf: strangerResponse.cookies.match(/nb_csrf=([^; ]+)/)![1] }
  const items = [{ storeId: 's1', productId: 'p1', qty: 1 }, { storeId: 's6', productId: 'p13', qty: 1 }]
  assert.equal((await request('/checkout/reservations', 'POST', buyer, { items, pickupWindow: '6:30 – 7:00 PM' })).status, 400)
  const result = await request('/checkout/orders', 'POST', buyer, { items, fulfillment: 'LOCAL_DELIVERY', paymentMethod: 'UPI', addressLine: 'H-14, Sector 22, Dwarka' })
  assert.equal(result.status, 200)
  assert.equal(result.result.data.orders.length, 2)
  assert.deepEqual(result.result.data.orders.map((o: any) => o.total).sort((a: number,b: number) => a - b), [379, 1329])
  const own = result.result.data.orders.find((o: any) => o.storeId === 'demo-store')
  const other = result.result.data.orders.find((o: any) => o.storeId === 's6')
  assert.ok(own && other)
  const sellerOrders = (await request('/orders?role=seller', 'GET', seller)).result.data
  assert.ok(sellerOrders.some((o: any) => o.id === own.id))
  assert.ok(!sellerOrders.some((o: any) => o.id === other.id))
  assert.equal((await request('/orders', 'GET', stranger)).result.data.length, 0)
  assert.equal((await request(`/orders/${own.id}/track`, 'GET', stranger)).status, 404)
  assert.equal((await request(`/orders/${own.id}/cancel`, 'POST', stranger)).status, 404)
  assert.equal((await request(`/orders/${own.id}/cancel`, 'POST', buyer)).status, 200)
  assert.equal((await request(`/orders/${own.id}/cancel`, 'POST', buyer)).status, 409)
  assert.equal((await request('/checkout/orders', 'POST', buyer, { items: [{ storeId: 's1', productId: 'p1', qty: 99 }], fulfillment: 'NEARBY_PICKUP', paymentMethod: 'COD' })).status, 409)
  assert.equal((await request('/checkout/orders', 'POST', buyer, { items: [{ storeId: 's1', productId: 'p1', qty: 7 }, { storeId: 's1', productId: 'p1', qty: 7 }], fulfillment: 'NEARBY_PICKUP', paymentMethod: 'COD' })).status, 409, 'duplicate lines cannot bypass stock checks')
})

test('seller store status gates checkout; only its owner can toggle it', async () => {
  const buyer = (await login('customer@nearbuy.dev', 'Customer@123')).session
  const seller = (await login('seller.sports@nearbuy.dev', 'Seller@123')).session
  const otherSellerResponse = await request('/auth/register', 'POST', undefined, { name: 'Other Seller', email: `other.seller.${Date.now()}@nearbuy.dev`, password: 'Seller@123', role: 'SELLER' })
  const other: Session = { cookies: otherSellerResponse.cookies, csrf: otherSellerResponse.cookies.match(/nb_csrf=([^; ]+)/)![1] }
  assert.equal((await request('/sellers/stores/demo-store', 'PATCH', buyer, { open: false })).status, 403)
  assert.equal((await request('/sellers/stores/demo-store', 'PATCH', other, { open: false })).status, 404)
  try {
    assert.equal((await request('/sellers/stores/demo-store', 'PATCH', seller, { open: false })).status, 200)
    assert.equal((await request('/preview/catalog', 'GET', buyer)).result.data.stores[0].open, false)
    assert.equal((await request('/checkout/orders', 'POST', buyer, { items: [{ storeId: 's1', productId: 'p1', qty: 1 }], fulfillment: 'NEARBY_PICKUP', paymentMethod: 'COD' })).status, 409)
  } finally {
    assert.equal((await request('/sellers/stores/demo-store', 'PATCH', seller, { open: true })).status, 200)
  }
})

test('a customer shelf check reaches the store and the answer belongs only to that customer', async () => {
  const buyer = (await login('customer@nearbuy.dev', 'Customer@123')).session
  const seller = (await login('seller.sports@nearbuy.dev', 'Seller@123')).session
  const otherBuyerResponse = await request('/auth/register', 'POST', undefined, {
    name: 'Another Buyer', email: `check.buyer.${Date.now()}@nearbuy.dev`, password: 'Customer@123', role: 'CUSTOMER',
  })
  const otherBuyer: Session = { cookies: otherBuyerResponse.cookies, csrf: otherBuyerResponse.cookies.match(/nb_csrf=([^; ]+)/)![1] }
  const sent = await request('/stock-requests', 'POST', buyer, { storeId: 's1', productId: 'p3', qty: 1 })
  assert.equal(sent.status, 200)
  const id = sent.result.data.id
  assert.equal((await request('/stock-requests/mine', 'GET', otherBuyer)).result.data.length, 0)
  assert.equal((await request('/inventory/confirm-requests', 'GET', buyer)).status, 403)
  assert.ok((await request('/inventory/confirm-requests', 'GET', seller)).result.data.some((x: any) => x.id === id))
  assert.equal((await request(`/inventory/confirm-requests/${id}/respond`, 'POST', buyer, { available: true })).status, 403)
  assert.equal((await request(`/inventory/confirm-requests/${id}/respond`, 'POST', seller, { available: true })).status, 200)
  assert.equal((await request('/stock-requests/mine', 'GET', buyer)).result.data.find((x: any) => x.id === id).status, 'AVAILABLE')
  assert.equal((await request(`/inventory/confirm-requests/${id}/respond`, 'POST', seller, { available: false })).status, 409)
})
