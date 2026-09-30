# NearBuy — Product Roadmap (condensed)

**“What You Need, Already Nearby.”** — Search Online • Find Nearby • Reserve • Pickup • Deliver

NearBuy is a **Local Commerce Operating System** connecting customers, neighborhood shops, brands,
delivery partners, warehouses and online sellers through one platform. The central idea:

> **Every product should have a “Where can I get this fastest, cheapest, or nearest?” answer.**

## Product pillars

| Pillar | Customer | Seller | Delivery | Admin |
| --- | --- | --- | --- | --- |
| Search & discovery | Home, Explore, Nearby, Search (product / nearby / price / fastest / store / AI), NearAI | Storefront, mini-store, QR | — | Demand Radar |
| Fulfillment | Delivery, fast, local, pickup, reserve; Compare Your Options; Basket Optimizer; One Trip | Orders, pickup windows, queue | Jobs, batching, heatmap | Fulfilment ops |
| Trust & intelligence | Availability confidence, live stock check, smart wishlist, reviews | Smart & predictive inventory, health metrics | — | Fraud & risk |

## Signature innovations (prototyped in this repo)

1. **Nearby Inventory Search** — products that physically exist around the customer
2. **Reserve & Pickup** — QR + pickup code + windows + expiry (see `/reservations`)
3. **Multi-Option Fulfillment** — standard, fast, local delivery, pickup, reserve
4. **Availability Confidence** — freshness of inventory updates, with **Live Stock Check**
5. **Demand Radar** — where searches outpace local supply (`/admin/radar`)
6. **Basket Optimizer** — cheapest / fastest / fewest stops across online + local
7. **NearAI** — grounded natural-language shopping assistant (`/nearai`)
8. **Store Without a Website** — digital storefront + Store QR (`/store/:id`, `/seller`)
9. **Nearby Now** — real-time urgent shopping (`/nearby-now`)
10. **Local Commerce OS** — inventory, orders, payments, delivery, analytics, discovery

Also included: Found Nearby summaries, Walk-In Ready, Hold For Me, Smart Deals that say
“Save ₹180 at a store 1.6 km away”, Local Market (makers/home businesses), What's Missing Near Me?,
Store Health Score (metrics with context, not one number), reservation windows & digital queue,
Event Mode, QuickBuy, NearPoints.

## Roadmap phases

- **Phase 0 (0–2 mo) — Foundation**: brand, architecture, database, auth, accounts, catalog, store
  profiles, location, search, inventory, admin panel
- **Phase 1 (2–4 mo) — MVP**: customer home/search/nearby/product/store/cart/checkout/pickup/
  reservation/local delivery/orders; seller dashboard/inventory/products/orders/reservations;
  admin sellers/products/users/orders/reservations
- **Phase 2 (4–8 mo) — Local Launch**: one city/zone, delivery app, maps, OTP, QR pickup, payments,
  ratings, coupons, notifications, verification, analytics, store QR
- **Phase 3 (8–14 mo) — Smart NearBuy**: NearAI, AI search, smart analytics, inventory alerts,
  Nearby Now, live stock confirmation, smart comparison, smart wishlist, personalization
- **Phase 4 (14–24 mo) — City-Scale**: multi-city/category, advanced delivery, multi-store cart,
  basket optimizer, demand radar, CRM, B2B/bulk, promotions, local market
- **Phase 5 (2–3 y) — National Scale**: major cities, large retailers, brands, warehouses,
  POS/ERP integrations, advanced logistics, API platform
- **Phase 6 (3 y+) — Global**: NearBuy India / UAE / UK / SEA with full localization
  (currency, language, tax, payments, delivery, verification, regulation)

## Maturity ladder

Online marketplace → nearby inventory finder → reservation + pickup platform → local delivery
marketplace → AI shopping assistant → local commerce platform → **commerce infrastructure**.

## Positioning

NearBuy should not compete only on “fast delivery”. Its broader proposition is:

> **“We find the best way for you to get what you need — online, at a nearby store, for pickup,
> for reservation, or deliverable from a local business.”** — a search-and-fulfillment layer
> connecting digital demand with physical inventory.

*This is a condensed digest of the full NearBuy product roadmap (71 sections) used to scope this
prototype.*
