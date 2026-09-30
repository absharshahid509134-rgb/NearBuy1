/**
 * NearBuy demo seed (§92) — realistic Delhi/Dwarka local-commerce data.
 *
 *   npx tsx packages/database/prisma/seed.ts
 *
 * Creates demo accounts (customer / sellers / admin / delivery partner),
 * six stores across Sports/Electronics/Stationery/Fashion/Books/Home,
 * the eight core products with realistic INR prices, per-store inventory,
 * coupons, orders, reservations, deliveries, reviews and notifications.
 */
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'
import { PrismaClient as PrismaClientWasm } from '@prisma/client/wasm'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new (PrismaClientWasm as unknown as {
  new (o: { adapter: PrismaPg }): PrismaClient
})({ adapter: new PrismaPg(pool) })

const HOME = { lat: 28.5921, lng: 77.046 } // Dwarka Sector 22

function near(dLat: number, dLng: number) {
  return { lat: HOME.lat + dLat, lng: HOME.lng + dLng }
}

async function main() {
  console.log(' seeding NearBuy demo data …')
  const password = (p: string) => bcrypt.hashSync(p, 10)

  // wipe all tables (except _prisma_migrations) so the seed is idempotent across reruns
  console.log(' clearing existing data …')
  await prisma.$executeRawUnsafe(`DO $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations')
    LOOP
      EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename);
    END LOOP;
  END $$;`)
  console.log(' cleared')

  // ── Users ────────────────────────────────────────────────────────────────
  const customer = await prisma.user.create({
    data: {
      email: 'customer@nearbuy.dev',
      passwordHash: password('Customer@123'),
      name: 'Aarav Sharma',
      role: 'CUSTOMER',
      phone: '+919810000001',
      locationLabel: 'Dwarka Sector 22, Delhi',
    },
  })
  const customer2 = await prisma.user.create({
    data: {
      email: 'meera@nearbuy.dev',
      passwordHash: password('Customer@123'),
      name: 'Meera Iyer',
      role: 'CUSTOMER',
      phone: '+919810000002',
      locationLabel: 'Dwarka Sector 21, Delhi',
    },
  })
  await prisma.customerProfile.createMany({
    data: [
      { userId: customer.id, loyaltyPts: 120 },
      { userId: customer2.id, loyaltyPts: 40 },
    ],
  })

  const sellerUsers = await Promise.all(
    [
      ['seller.sports@nearbuy.dev', 'Rajesh Malhotra', 'Malhotra Sports Pvt Ltd', 'Sports'],
      ['seller.electronics@nearbuy.dev', 'Anita Desai', 'Desai Electronics', 'Electronics'],
      ['seller.stationery@nearbuy.dev', 'Vikram Sethi', 'Sethi Stationers', 'Stationery'],
      ['seller.fashion@nearbuy.dev', 'Priya Nair', 'Nair Fashion House', 'Fashion'],
      ['seller.books@nearbuy.dev', 'Kabir Anand', 'Anand Book Depot', 'Books'],
      ['seller.home@nearbuy.dev', 'Sunita Rao', 'Rao Home Stores', 'Home'],
      ['seller.grocery@nearbuy.dev', 'Farah Khan', 'Dwarka Fresh Mart', 'Grocery'],
    ].map(async ([email, name, legal], i) => {
      const u = await prisma.user.create({
        data: { email, passwordHash: password('Seller@123'), name, role: 'SELLER', phone: `+9198200000${10 + i}` },
      })
      const s = await prisma.seller.create({ data: { userId: u.id, legalName: legal, verified: true, verifiedAt: new Date(), rating: 4.5 + Math.random() * 0.4 } })
      return { user: u, seller: s, kind: legal }
    }),
  )

  const admin = await prisma.user.create({
    data: { email: 'admin@nearbuy.dev', passwordHash: password('Admin@123'), name: 'NearBuy Admin', role: 'ADMIN', phone: '+919810000009' },
  })
  const support = await prisma.user.create({
    data: { email: 'support@nearbuy.dev', passwordHash: password('Support@123'), name: 'Neha Support', role: 'SUPPORT_AGENT', phone: '+919810000010' },
  })
  const rider = await prisma.user.create({
    data: { email: 'delivery@nearbuy.dev', passwordHash: password('Delivery@123'), name: 'Arjun Rider', role: 'DELIVERY_PARTNER', phone: '+919810000011' },
  })
  const partner = await prisma.deliveryPartner.create({
    data: { userId: rider.id, vehicle: 'bike', zone: 'Dwarka', available: true, rating: 4.8, deliveries: 132, earningsCt: 4860 },
  })

  // ── Categories & brands ─────────────────────────────────────────────────
  const catData = [
    ['Sports', 'sports', '🏏'],
    ['Electronics', 'electronics', '🎧'],
    ['Stationery', 'stationery', '📓'],
    ['Fashion', 'fashion', '👟'],
    ['Books', 'books', '📚'],
    ['Home & Kitchen', 'home-kitchen', '🏠'],
    ['School Supplies', 'school-supplies', '🎒'],
    ['Grocery', 'grocery', '🥛'],
  ] as const
  const categories: Record<string, string> = {}
  for (const [name, slug, emoji] of catData) {
    const c = await prisma.category.create({ data: { name, slug, emoji } })
    categories[slug] = c.id
  }
  const brandData = [
    ['Nivia', 'nivia'],
    ['Aeroflex', 'aeroflex'],
    ['Skyline', 'skyline'],
    ['SonicBeat', 'sonicbeat'],
    ['Classmate', 'classmate'],
    ['VoltEdge', 'voltedge'],
    ['Hydra', 'hydra'],
    ['SS Cricket', 'ss-cricket'],
    ['Amul', 'amul'],
    ['Aashirvaad', 'aashirvaad'],
  ] as const
  const brands: Record<string, string> = {}
  for (const [name, slug] of brandData) {
    const b = await prisma.brand.create({ data: { name, slug } })
    brands[slug] = b.id
  }

  // ── Products (the eight core demo products) ──────────────────────────────
  interface P {
    name: string
    slug: string
    sku: string
    cat: string
    brand: string
    desc: string
    emoji: string
    list: number
    mrp: number
    tags: string[]
  }
  const productsData: P[] = [
    { name: 'Nivia Volleyball Pro', slug: 'nivia-volleyball-pro', sku: 'NIV-VB-PRO', cat: 'sports', brand: 'nivia', emoji: '🏐', list: 699, mrp: 999, desc: 'Official-size synthetic volleyball with soft-touch grip. Made for courts, parks and gali cricket-turned-volleyball evenings.', tags: ['volleyball', 'sports', 'nivia'] },
    { name: 'Aeroflex Running Shoes', slug: 'aeroflex-running-shoes', sku: 'AER-RUN-01', cat: 'fashion', brand: 'aeroflex', emoji: '👟', list: 2499, mrp: 3499, desc: 'Breathable knit upper, responsive foam sole. Built for morning laps at the Sector 22 ground.', tags: ['shoes', 'running', 'footwear'] },
    { name: 'Skyline School Bag', slug: 'skyline-school-bag', sku: 'SKY-BAG-02', cat: 'school-supplies', brand: 'skyline', emoji: '🎒', list: 899, mrp: 1299, desc: 'Water-resistant 30L backpack with padded laptop sleeve and bottle pocket. Survives the school year.', tags: ['bag', 'school', 'backpack'] },
    { name: 'SonicBeat Headphones', slug: 'sonicbeat-headphones', sku: 'SON-HP-40', cat: 'electronics', brand: 'sonicbeat', emoji: '🎧', list: 1999, mrp: 2999, desc: 'Over-ear wireless headphones, 40h battery, deep bass and passive noise isolation.', tags: ['headphones', 'audio', 'wireless'] },
    { name: 'Classmate Notebook 200pg', slug: 'classmate-notebook-200pg', sku: 'CLS-NB-200', cat: 'stationery', brand: 'classmate', emoji: '📓', list: 55, mrp: 80, desc: 'Single-ruled 200-page notebook with thick non-bleed pages. The everyday workhorse.', tags: ['notebook', 'stationery', 'school'] },
    { name: 'VoltEdge USB-C Cable 1m', slug: 'voltedge-usb-c-cable-1m', sku: 'VLT-CBL-1M', cat: 'electronics', brand: 'voltedge', emoji: '🔌', list: 199, mrp: 399, desc: 'Braided USB-C to USB-C cable, 60W PD fast charging, 1m length. Tangle-free, tested to 10k bends.', tags: ['usb', 'cable', 'charging'] },
    { name: 'Hydra Steel Bottle 1L', slug: 'hydra-steel-bottle-1l', sku: 'HYD-BTL-1L', cat: 'home-kitchen', brand: 'hydra', emoji: '💧', list: 349, mrp: 499, desc: 'Double-walled insulated steel bottle — 12h cold, 6h hot. Fits school bags and car holders.', tags: ['bottle', 'steel', 'insulated'] },
    { name: 'SS Willow Cricket Bat', slug: 'ss-willow-cricket-bat', sku: 'SS-CB-WIL', cat: 'sports', brand: 'ss-cricket', emoji: '🏏', list: 2499, mrp: 3499, desc: 'Kashmir willow bat with thick edges and pre-knocked blade. Ready for the gali tournament.', tags: ['cricket', 'bat', 'sports'] },
    { name: 'Classmate Geometry Box', slug: 'classmate-geometry-box', sku: 'CLS-GEO-01', cat: 'school-supplies', brand: 'classmate', emoji: '📐', list: 149, mrp: 199, desc: '10-piece metal geometry set in a slim tin case.', tags: ['geometry', 'school', 'stationery'] },
    { name: 'SonicBeat Earbuds Mini', slug: 'sonicbeat-earbuds-mini', sku: 'SON-BUD-02', cat: 'electronics', brand: 'sonicbeat', emoji: '🎵', list: 1299, mrp: 1999, desc: 'TWS earbuds with ENC calls, 28h case battery and low-latency game mode.', tags: ['earbuds', 'tws', 'audio'] },
    { name: 'Aeroflex Sports Tee', slug: 'aeroflex-sports-tee', sku: 'AER-TEE-01', cat: 'fashion', brand: 'aeroflex', emoji: '👕', list: 499, mrp: 799, desc: 'Quick-dry polyester tee with mesh vents. For the court and after.', tags: ['tshirt', 'sports', 'activewear'] },
    { name: 'Hydra Lunch Box Steel', slug: 'hydra-lunch-box-steel', sku: 'HYD-LB-02', cat: 'home-kitchen', brand: 'hydra', emoji: '🍱', list: 599, mrp: 899, desc: 'Two-compartment leak-resistant steel lunch box with insulated carry sleeve.', tags: ['lunchbox', 'steel', 'kitchen'] },
    { name: 'Amul Taaza Milk 1L', slug: 'amul-taaza-milk-1l', sku: 'AMU-TZ-1L', cat: 'grocery', brand: 'amul', emoji: '🥛', list: 68, mrp: 72, desc: 'Pasteurised full-cream milk, packed fresh every morning. The daily staple of every Dwarka kitchen.', tags: ['milk', 'dairy', 'grocery', 'daily'] },
    { name: 'Amul Butter 500g', slug: 'amul-butter-500g', sku: 'AMU-BT-500', cat: 'grocery', brand: 'amul', emoji: '🧈', list: 285, mrp: 310, desc: 'Classic yellow butter in a metal tub — for rotis, toast and everything in between.', tags: ['butter', 'dairy', 'grocery'] },
    { name: 'Aashirvaad Atta 5kg', slug: 'aashirvaad-atta-5kg', sku: 'AAS-AT-5KG', cat: 'grocery', brand: 'aashirvaad', emoji: '🌾', list: 245, mrp: 280, desc: 'Whole-wheat atta, stone-ground and coarse-milled. Parathas at home in minutes.', tags: ['atta', 'flour', 'grocery'] },
  ]

  const products: Record<string, { id: string; data: P }> = {}
  for (const p of productsData) {
    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        brandId: brands[p.brand],
        categoryId: categories[p.cat],
        description: p.desc,
        emoji: p.emoji,
        tags: p.tags,
        rating: Math.round((3.9 + Math.random() * 1.0) * 10) / 10,
        ratingCount: 8 + Math.floor(Math.random() * 60),
        metaTitle: `${p.name} — buy nearby in Dwarka | NearBuy`,
        metaDesc: `${p.desc.slice(0, 120)} Reserve online, pick up nearby today.`,
        images: {
          create: [
            { url: `/images/products/${p.slug}.jpg`, alt: p.name, position: 0 },
            { url: `/images/local-market.jpg`, alt: `${p.name} at a local store`, position: 1 },
          ],
        },
      },
    })
    await prisma.price.create({
      data: { productId: created.id, listPrice: p.list, mrp: p.mrp, onlinePrice: Math.round(p.list * 1.05), etaMin: 3, etaMax: 5 },
    })
    products[p.slug] = { id: created.id, data: p }
  }

  // ── Stores (6 — one per vertical) ────────────────────────────────────────
  interface S {
    name: string
    slug: string
    category: string
    blurb: string
    emoji: string
    area: string
    address: string
    pos: { lat: number; lng: number }
    sellerIdx: number
    rating: number
    reviews: number
    localMaker?: boolean
    cover: string
  }
  const storesData: S[] = [
    { name: 'Dwarka Sports Hub', slug: 'dwarka-sports-hub', category: 'Sports', blurb: 'Courts, bats and everything gali sports. Family-run since 2009.', emoji: '🏏', area: 'Sector 22, Dwarka', address: 'Shop 12, Main Market, Sector 22, Dwarka, Delhi 110077', pos: near(0.004, 0.003), sellerIdx: 0, rating: 4.6, reviews: 214, cover: '/images/store-sports.jpg' },
    { name: 'Sector 22 Gadget Store', slug: 'sector-22-gadget-store', category: 'Electronics', blurb: 'Audio, cables and accessories — tested before they leave the counter.', emoji: '🎧', area: 'Sector 22, Dwarka', address: 'Shop 4, Electronics Lane, Sector 22, Dwarka, Delhi 110077', pos: near(0.002, -0.004), sellerIdx: 1, rating: 4.4, reviews: 168, cover: '/images/store-electronics.jpg' },
    { name: 'Stationery World', slug: 'stationery-world', category: 'Stationery', blurb: 'Notebooks, geometry boxes and school lists sorted in one trip.', emoji: '📓', area: 'Sector 21, Dwarka', address: 'Shop 8, School Lane, Sector 21, Dwarka, Delhi 110075', pos: near(-0.005, 0.002), sellerIdx: 2, rating: 4.7, reviews: 302, cover: '/images/school-supplies.jpg' },
    { name: 'Urban Thread Fashion', slug: 'urban-thread-fashion', category: 'Fashion', blurb: 'Activewear and everyday shoes from a boutique that knows your size.', emoji: '👟', area: 'Sector 23, Dwarka', address: 'Shop 21, Boutique Row, Sector 23, Dwarka, Delhi 110077', pos: near(0.007, 0.006), sellerIdx: 3, rating: 4.3, reviews: 96, cover: '/images/gifts.jpg' },
    { name: 'Books & Beyond', slug: 'books-and-beyond', category: 'Books', blurb: 'School texts to Sunday novels — ask us, we know the shelves.', emoji: '📚', area: 'Sector 19, Dwarka', address: 'Shop 3, Library Walk, Sector 19, Dwarka, Delhi 110075', pos: near(-0.008, -0.005), sellerIdx: 4, rating: 4.8, reviews: 251, cover: '/images/local-market.jpg' },
    { name: 'Home Needs Store', slug: 'home-needs-store', category: 'Home', blurb: 'Bottles, lunch boxes and the small things that run a home. Local makers welcome.', emoji: '🏠', area: 'Sector 22, Dwarka', address: 'Shop 17, Daily Needs Market, Sector 22, Dwarka, Delhi 110077', pos: near(0.001, 0.008), sellerIdx: 5, rating: 4.5, reviews: 143, localMaker: true, cover: '/images/hero.jpg' },
    { name: 'Dwarka Fresh Mart', slug: 'dwarka-fresh-mart', category: 'Grocery', blurb: 'Dairy, staples and the morning run done for you — stocked fresh every day.', emoji: '🥛', area: 'Sector 22, Dwarka', address: 'Shop 5, Fresh Market, Sector 22, Dwarka, Delhi 110077', pos: near(0.003, -0.002), sellerIdx: 6, rating: 4.6, reviews: 87, cover: '/images/local-market.jpg' },
  ]

  const stores: Record<string, string> = {}
  for (const s of storesData) {
    const created = await prisma.store.create({
      data: {
        sellerId: sellerUsers[s.sellerIdx].seller.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        blurb: s.blurb,
        emoji: s.emoji,
        area: s.area,
        address: s.address,
        city: 'Delhi',
        pincode: s.area.includes('21') || s.area.includes('19') ? '110075' : '110077',
        phone: '+919812345678',
        open: true,
        hours: '9:00 AM – 9:30 PM',
        opensAt: '9:00 AM',
        verified: true,
        pickupEnabled: true,
        localDelivery: true,
        localDeliveryKm: 5,
        prepMins: 10 + Math.floor(Math.random() * 8),
        rating: s.rating,
        reviewCount: s.reviews,
        followers: 40 + Math.floor(Math.random() * 300),
        coverUrl: s.cover,
        localMaker: s.localMaker ?? false,
        lat: s.pos.lat,
        lng: s.pos.lng,
      },
    })
    stores[s.slug] = created.id
    await prisma.storeStaff.create({
      data: { storeId: created.id, userId: sellerUsers[s.sellerIdx].user.id, role: 'STORE_STAFF' },
    })
  }

  // ── Inventory (each store stocks its vertical + cross-sellers) ────────────
  async function stock(storeSlug: string, productSlug: string, qty: number, price: number) {
    const inv = await prisma.inventory.create({
      data: {
        storeId: stores[storeSlug],
        productId: products[productSlug].id,
        quantity: qty,
        reservedQuantity: 0,
        availableQuantity: qty,
        price,
        status: qty === 0 ? 'OUT_OF_STOCK' : qty <= 4 ? 'LOW_STOCK' : 'IN_STOCK',
        lastUpdatedAt: new Date(Date.now() - Math.floor(Math.random() * 50) * 60_000),
      },
    })
    return inv
  }

  await stock('dwarka-sports-hub', 'nivia-volleyball-pro', 14, 699)
  await stock('dwarka-sports-hub', 'ss-willow-cricket-bat', 6, 2499)
  await stock('dwarka-sports-hub', 'aeroflex-sports-tee', 20, 499)
  await stock('dwarka-sports-hub', 'hydra-steel-bottle-1l', 9, 349)
  await stock('sector-22-gadget-store', 'sonicbeat-headphones', 8, 1999)
  await stock('sector-22-gadget-store', 'voltedge-usb-c-cable-1m', 40, 199)
  await stock('sector-22-gadget-store', 'sonicbeat-earbuds-mini', 5, 1299)
  await stock('stationery-world', 'classmate-notebook-200pg', 120, 55)
  await stock('stationery-world', 'skyline-school-bag', 11, 899)
  await stock('stationery-world', 'classmate-geometry-box', 34, 149)
  await stock('urban-thread-fashion', 'aeroflex-running-shoes', 7, 2499)
  await stock('urban-thread-fashion', 'aeroflex-sports-tee', 15, 499)
  await stock('books-and-beyond', 'classmate-notebook-200pg', 60, 55)
  await stock('books-and-beyond', 'skyline-school-bag', 4, 899)
  await stock('home-needs-store', 'hydra-steel-bottle-1l', 16, 349)
  await stock('home-needs-store', 'hydra-lunch-box-steel', 10, 599)
  await stock('home-needs-store', 'voltedge-usb-c-cable-1m', 12, 199)
  await stock('dwarka-fresh-mart', 'amul-taaza-milk-1l', 10, 68)
  await stock('dwarka-fresh-mart', 'amul-butter-500g', 8, 285)
  await stock('dwarka-fresh-mart', 'aashirvaad-atta-5kg', 6, 245)

  // ── Coupons & promotions ─────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', type: 'PERCENT', value: 10, minOrder: 299, firstOrderOnly: true, expiresAt: new Date(Date.now() + 30 * 864e5) },
      { code: 'NEARBUY50', type: 'FIXED', value: 50, minOrder: 499, expiresAt: new Date(Date.now() + 14 * 864e5) },
    ],
  })
  await prisma.promotion.createMany({
    data: [
      { storeId: stores['dwarka-sports-hub'], title: 'Weekend Sports Sale', kind: 'FLASH', detail: 'Flat 10% on bats & balls for nearby customers', savings: 250, endsAt: new Date(Date.now() + 3 * 864e5) },
      { storeId: stores['stationery-world'], title: 'School Season Bundle', kind: 'BUNDLE', detail: 'Bag + 4 notebooks + geometry box — one price', savings: 300, endsAt: new Date(Date.now() + 10 * 864e5) },
      { storeId: stores['home-needs-store'], title: 'Local Makers Week', kind: 'LOCAL', detail: 'Support Dwarka home-makers — free local delivery', savings: 30, endsAt: new Date(Date.now() + 7 * 864e5) },
    ],
  })

  // ── Orders (history + live) ──────────────────────────────────────────────
  const volleyballInv = await prisma.inventory.findFirstOrThrow({ where: { storeId: stores['dwarka-sports-hub'], productId: products['nivia-volleyball-pro'].id } })
  const pastOrder = await prisma.order.create({
    data: {
      number: 'NB-DEMO-1001',
      userId: customer.id,
      storeId: stores['dwarka-sports-hub'],
      status: 'COMPLETED',
      fulfillmentMethod: 'NEARBY_PICKUP',
      subtotal: 699,
      deliveryFee: 0,
      discount: 0,
      total: 699,
      addressSnap: { label: 'home', line1: '14A, Pocket 6', area: 'Sector 22, Dwarka', city: 'Delhi', pincode: '110077', ...HOME },
      events: [
        { label: 'Order Placed', at: new Date(Date.now() - 3 * 864e5).toISOString() },
        { label: 'Order Confirmed', at: new Date(Date.now() - 3 * 864e5 + 3e5).toISOString() },
        { label: 'Ready for Pickup', at: new Date(Date.now() - 3 * 864e5 + 9e5).toISOString() },
        { label: 'Completed', at: new Date(Date.now() - 3 * 864e5 + 15e5).toISOString() },
      ],
      items: { create: [{ productId: products['nivia-volleyball-pro'].id, inventoryId: volleyballInv.id, storeId: stores['dwarka-sports-hub'], name: 'Nivia Volleyball Pro', qty: 1, unitPrice: 699 }] },
    },
  })
  await prisma.fulfillment.create({ data: { orderId: pastOrder.id, method: 'NEARBY_PICKUP', status: 'COMPLETED', fee: 0, etaMins: 25 } })
  await prisma.payment.create({ data: { orderId: pastOrder.id, userId: customer.id, method: 'UPI', status: 'PAID', amount: 699, providerRef: 'mock_pay_demo1001' } })
  await prisma.review.create({
    data: { userId: customer.id, productId: products['nivia-volleyball-pro'].id, storeId: stores['dwarka-sports-hub'], orderId: pastOrder.id, kind: 'PRODUCT', rating: 5, text: 'Reserved online, picked up in 20 min. Grip is genuinely good.' },
  })

  const headphonesInv = await prisma.inventory.findFirstOrThrow({ where: { storeId: stores['sector-22-gadget-store'], productId: products['sonicbeat-headphones'].id } })
  const liveOrder = await prisma.order.create({
    data: {
      number: 'NB-DEMO-1002',
      userId: customer.id,
      storeId: stores['sector-22-gadget-store'],
      status: 'CONFIRMED',
      fulfillmentMethod: 'LOCAL_DELIVERY',
      subtotal: 1999,
      deliveryFee: 30,
      discount: 50,
      total: 1979,
      couponCode: 'NEARBUY50',
      addressSnap: { label: 'home', line1: '14A, Pocket 6', area: 'Sector 22, Dwarka', city: 'Delhi', pincode: '110077', ...HOME },
      events: [
        { label: 'Order Placed', at: new Date(Date.now() - 36e5).toISOString() },
        { label: 'Order Confirmed', at: new Date(Date.now() - 30e5).toISOString() },
      ],
      items: { create: [{ productId: products['sonicbeat-headphones'].id, inventoryId: headphonesInv.id, storeId: stores['sector-22-gadget-store'], name: 'SonicBeat Headphones', qty: 1, unitPrice: 1999 }] },
    },
  })
  await prisma.fulfillment.create({ data: { orderId: liveOrder.id, method: 'LOCAL_DELIVERY', status: 'ACCEPTED', fee: 30, etaMins: 45 } })
  await prisma.payment.create({ data: { orderId: liveOrder.id, userId: customer.id, method: 'COD', status: 'PENDING', amount: 1979, providerRef: 'mock_pay_demo1002' } })
  await prisma.delivery.create({
    data: { orderId: liveOrder.id, status: 'PENDING', fee: 30, distanceKm: 1.2, pickupCode: '4417', dropCode: '8821' },
  })

  // ── Reservations (the signature flow) ────────────────────────────────────
  const batInv = await prisma.inventory.findFirstOrThrow({ where: { storeId: stores['dwarka-sports-hub'], productId: products['ss-willow-cricket-bat'].id } })
  const readyRes = await prisma.reservation.create({
    data: {
      code: 'NB-4417',
      qrPayload: 'nearbuy://pickup/NB-4417',
      userId: customer.id,
      storeId: stores['dwarka-sports-hub'],
      status: 'READY_FOR_PICKUP',
      pickupWindow: 'Today 5:00–5:30 PM',
      expiresAt: new Date(Date.now() + 2 * 36e5),
      events: [
        { label: 'Reservation Requested', at: new Date(Date.now() - 54e5).toISOString() },
        { label: 'Reservation Confirmed', at: new Date(Date.now() - 50e5).toISOString() },
        { label: 'Packed', at: new Date(Date.now() - 20e5).toISOString() },
        { label: 'Ready for Pickup', at: new Date(Date.now() - 10e5).toISOString() },
      ],
      items: { create: [{ productId: products['ss-willow-cricket-bat'].id, qty: 1, unitPrice: 2499 }] },
    },
  })
  // hold the stock for the ready reservation
  await prisma.inventory.update({
    where: { id: batInv.id },
    data: { reservedQuantity: { increment: 1 }, availableQuantity: { decrement: 1 } },
  })
  await prisma.inventoryReservation.create({ data: { inventoryId: batInv.id, reservationId: readyRes.id, quantity: 1 } })

  await prisma.reservation.create({
    data: {
      code: 'NB-2210',
      qrPayload: 'nearbuy://pickup/NB-2210',
      userId: customer2.id,
      storeId: stores['stationery-world'],
      status: 'REQUESTED',
      pickupWindow: 'Today 6:30–7:00 PM',
      expiresAt: new Date(Date.now() + 3 * 36e5),
      events: [{ label: 'Reservation Requested', at: new Date(Date.now() - 12e5).toISOString() }],
      items: {
        create: [
          { productId: products['classmate-notebook-200pg'].id, qty: 4, unitPrice: 55 },
          { productId: products['classmate-geometry-box'].id, qty: 1, unitPrice: 149 },
        ],
      },
    },
  })
  await prisma.reservation.create({
    data: {
      code: 'NB-7788',
      qrPayload: 'nearbuy://pickup/NB-7788',
      userId: customer.id,
      storeId: stores['home-needs-store'],
      status: 'COMPLETED',
      pickupWindow: 'Yesterday 7:00–7:30 PM',
      expiresAt: new Date(Date.now() - 20 * 36e5),
      events: [
        { label: 'Reservation Requested', at: new Date(Date.now() - 26 * 36e5).toISOString() },
        { label: 'Reservation Confirmed', at: new Date(Date.now() - 25 * 36e5).toISOString() },
        { label: 'Collected & Completed', at: new Date(Date.now() - 23 * 36e5).toISOString() },
      ],
      items: { create: [{ productId: products['hydra-lunch-box-steel'].id, qty: 1, unitPrice: 599 }] },
    },
  })

  // ── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: customer.id, event: 'reservation_ready', title: 'Your reservation is ready 🎒', body: 'NB-4417 at Dwarka Sports Hub — show your code at the counter (Today 5:00–5:30 PM).', channel: 'IN_APP' },
      { userId: customer.id, event: 'order_confirmed', title: 'Order NB-DEMO-1002 confirmed', body: 'SonicBeat Headphones are being packed at Sector 22 Gadget Store for local delivery.', channel: 'IN_APP' },
      { userId: customer2.id, event: 'reservation_requested', title: 'Reservation NB-2210 received', body: 'Stationery World will confirm your 5-item reservation shortly.', channel: 'IN_APP' },
      { userId: sellerUsers[0].user.id, event: 'reservation_request', title: 'New reservation to confirm', body: 'NB-4417 — 1 × SS Willow Cricket Bat. Confirm within 30 minutes.', channel: 'IN_APP' },
      { userId: sellerUsers[1].user.id, event: 'new_order', title: 'New local delivery order', body: 'NB-DEMO-1002 — 1 × SonicBeat Headphones. Needs packing.', channel: 'IN_APP' },
    ],
  })

  // ── Search history (Demand Radar) ────────────────────────────────────────
  await prisma.searchQuery.createMany({
    data: [
      { userId: customer.id, query: 'volleyball', area: 'Sector 22, Dwarka', resultCount: 3, hadLocal: true, lat: HOME.lat, lng: HOME.lng },
      { userId: customer2.id, query: 'badminton shuttlecocks', area: 'Sector 21, Dwarka', resultCount: 0, hadLocal: false },
      { query: 'yoga mat', area: 'Sector 22, Dwarka', resultCount: 0, hadLocal: false },
      { query: 'cricket bat', area: 'Sector 22, Dwarka', resultCount: 2, hadLocal: true },
      { query: 'yoga mat', area: 'Sector 23, Dwarka', resultCount: 0, hadLocal: false },
    ],
  })

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: 'seed_completed', entity: 'System', meta: { products: productsData.length, stores: storesData.length } },
  })

  console.log(' seed complete.')
  console.log('   customer@nearbuy.dev / Customer@123')
  console.log('   seller.sports@nearbuy.dev (and 5 more sellers) / Seller@123')
  console.log('   admin@nearbuy.dev / Admin@123')
  console.log('   delivery@nearbuy.dev / Delivery@123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
