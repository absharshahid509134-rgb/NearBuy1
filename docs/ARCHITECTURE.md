# NearBuy — Target Architecture (Storefront-Scale Blueprint)

> **Spec status.** The primary specification is the **80-section NearBuy Storefront
> blueprint** (multi-vendor marketplace + quick commerce + services). NearBuy's
> own differentiator from blueprint §80 is merged in and stays first-class:
> **online sellers + local shops, real-time nearby inventory, reserve & pickup,
> hyperlocal delivery, nearby deals, location intelligence.**
> Prior decisions that conflict with the blueprint (7-role RBAC, the
> `#2563EB` token set, modular-monolith-only deployment) are **superseded**.

---

## 1. Product identity

**NearBuy** — a Storefront-scale marketplace where every product can be bought
two ways:

- **Online sellers** — warehouse stock, shipped (standard/express/scheduled).
- **Local shops** — live shelf inventory, **reserve & pickup today**, hyperlocal
  delivery, nearby deals (the NearBuy Minutes-style surface, powered by real
  store inventory).

Everything a modern marketplace needs — catalog, search, cart, checkout,
pricing engine, coupon rules engine, payments, orders, shipments, **returns /
replacements / refunds**, reviews & Q&A, rewards (SuperCoins-style ledger),
loyalty, ads/campaigns, fraud & risk, recommendations, CMS, analytics — sits
under one platform.

## 2. System context

```
                         CUSTOMER APP (web / mobile PWA / seller hub / admin)
                                        │ HTTPS
                                 API GATEWAY (/api/v1)
                                        │
        ┌───────────────┬───────────────┼────────────────┬────────────────┐
        ▼               ▼               ▼                ▼                ▼
    CATALOG         COMMERCE        POST-PURCHASE     GROWTH           OPS
   catalog          cart            returns          coupons          fraud
   search           orders          refunds          rewards          support
   pricing          payments        notifications    campaigns/ads    analytics
   reviews/Q&A      inventory       recommendations  loyalty          ai
   sellers          logistics
   warehouses       auth/users
        │               │               │                │                │
        └───────────────┴───────────────┴──────┬─────────┴────────────────┘
                                               ▼
                          PostgreSQL · Redis · Search (PG→OpenSearch) ·
                          Object storage (S3/MinIO) · Job queues · Event bus
```

## 3. Service map (separately deployable)

Each service is a **composition root** over shared kernel modules
(`packages/server-core`) — deployable as its own process/container, or composed
into the single-process gateway for local dev. No business logic is duplicated;
the split is at the **process boundary** (blueprint §56/§59). Inter-service
calls use HTTP contracts (or in-process when composed) plus async events
(notifications, analytics, fraud signals).

| Service | Port | Composed modules | Status |
| --- | --- | --- | --- |
| `gateway` | 3001 | **everything** (incl. Admin) — single-process mode + BFF | live |
| `auth` | 3101 | AuthModule | live |
| `users` | 3102 | UsersModule, WishlistModule | live |
| `catalog` | 3103 | ProductsModule (products/categories/brands/variants/media) | live |
| `search` | 3104 | SearchModule (NL→filters, FOUND-NEARBY rollups) | live |
| `pricing` | 3105 | PricingEngine (extracted from checkout) | phase: post-purchase |
| `cart` | 3106 | CartModule, CheckoutModule (multi-store baskets, optimizer) | live |
| `orders` | 3107 | OrdersModule, ReservationsModule | live |
| `payments` | 3108 | PaymentsModule (provider abstraction, webhooks) | live |
| `inventory` | 3109 | InventoryModule (transactional holds — no overselling) | live |
| `sellers` | 3110 | SellersModule, StoresModule (local shops = fulfillment nodes) | live |
| `warehouses` | 3111 | Warehouse/stock-movement module | phase: logistics |
| `logistics` | 3112 | DeliveryModule, FulfillmentModule (5-method engine) | live |
| `returns` | 3113 | **ReturnsModule** (return/replacement state machine) | **P1 — next** |
| `refunds` | 3114 | **RefundsModule** (refund ledger over payment transactions) | **P1 — next** |
| `reviews` | 3115 | ReviewsModule (verified-purchase, media, Q&A) | live (Q&A/media P1) |
| `recommendations` | 3116 | RecommendationModule (because-you-viewed, FBT) | phase: intelligence |
| `coupons` | 3117 | CouponsModule, PromotionsModule (rules engine) | live (rules P1) |
| `rewards` | 3118 | RewardsModule (immutable SuperCoins-style ledger) | phase: growth |
| `notifications` | 3119 | NotificationsModule (multi-channel events) | live |
| `support` | 3120 | SupportModule (tickets + messages, AI-assisted) | shell (messages P1) |
| `fraud` | 3121 | FraudModule (risk signals → score → allow/review/block) | phase: trust |
| `ai` | 3122 | AiModule (grounded NearAI: assistant, compare, seller copilot) | live |
| `analytics` | 3123 | AnalyticsModule (event pipeline, funnels) | shell (events P1) |

Shell = deployable composition root + health endpoints wired to the shared
kernel; its feature module lands in the phase marked. This keeps the service
topology stable while delivery stays incremental (no fake logic).

## 4. Monorepo layout

```
apps/
  web/          customer storefront (Next.js, PWA)  [planned]
  seller/       seller hub (Next.js)                [planned]
  admin/        admin panel + City Command Center    [planned]
  mobile/       PWA shell / future RN client
services/       23 deployable composition roots (thin mains)
packages/
  server-core/  shared kernel: common (config, errors, http, guards) + all feature modules
  database/     Prisma schema, migrations, migrate runner, seed
  ui/           design system (tokens, components) — §7 look
  types/ validation/ config/        shared contracts
  ai/ analytics/ maps/ notifications/ payments/ search/   provider abstractions
backend/        gateway composition root (all modules, one process)
scripts/        dev-db, migrate, postgenerate (Prisma WASM wiring)
docs/           ARCHITECTURE · DATABASE · DESIGN-SYSTEM · PRODUCT-ROADMAP · …
```

## 5. Data model (see `docs/DATABASE.md`)

Blueprint §54/§55 maps onto Prisma models in `packages/database/prisma`:

- **Catalog** — Product, ProductVariant, ProductImage, Brand, Category, Price.
  Multi-seller listing = `Inventory` row per (store, product[, variant]) carrying
  listing price + live stock; `Warehouse`/`StockMovement` extend this to WMS.
- **Commerce** — Cart/CartItem, Order/OrderItem, Fulfillment, Reservation
  (reserve & pickup), Delivery/DeliveryEvent, Payment + **PaymentTransaction**
  (gateway ledger) + Refund.
- **Post-purchase** — OrderStatusHistory, Invoice, ReturnRequest/ReturnItem,
  ReplacementOrder (P1).
- **Growth** — Coupon (+`conditions` rules), CouponProduct, Campaign,
  Advertisement, RewardWallet + **RewardTransaction** (immutable ledger).
- **Trust/ops** — Review/ReviewMedia, Question/Answer, SupportTicket/
  SupportMessage, FraudEvent, AuditLog, SearchQuery/ClickEvent/AnalyticsEvent.

**Inventory formula (never violated):** `available = quantity − reservedQuantity`.
All stock changes go through `InventoryService` conditional updates inside
transactions. **Rewards formula:** wallet balance is only ever mutated in the
same transaction as an appended `RewardTransaction`; the ledger is authoritative.

## 6. Identity, roles & access (RBAC)

JWT access (15 m) + refresh (7 d, rotating, httpOnly cookie), email+password,
phone+OTP, OAuth-ready. Roles (blueprint §68):

| Role | Scope |
| --- | --- |
| `CUSTOMER` | own account, orders, returns, rewards |
| `SELLER` | own stores, listings, inventory, orders, returns, settlements |
| `SELLER_EMPLOYEE` | store-scoped seller ops (assigned stores only) |
| `WAREHOUSE_STAFF` | receiving, put-away, picking, packing, dispatch (legacy: `STORE_STAFF`) |
| `DELIVERY_PARTNER` | assigned deliveries, pickup/drop codes |
| `SUPPORT_AGENT` | tickets, order/return assistance (no finance) |
| `CONTENT_MANAGER` | CMS: banners, campaigns copy, SEO metadata |
| `FINANCE_ADMIN` | payments, refunds, settlements |
| `LOGISTICS_ADMIN` | network, hubs, SLAs, control tower |
| `PRODUCT_ADMIN` | catalog moderation, sellers approval (legacy: `ADMIN`) |
| `SUPER_ADMIN` | platform everything, audit access |

Every request is authorized **server-side**; tenancy rules (seller sees only own
data) are enforced in services, never in the frontend.

## 7. API conventions

- Versioned REST: `/api/v1/<resource>`, OpenAPI at `/api/docs` (per service).
- Envelope: `{success, data, requestId, meta?}` / `{success, error:{code,message,details?}, requestId}`.
- Cursor pagination for big sets; filtering/sorting whitelisted per endpoint.
- Rate limiting (§68 throttles), helmet, CORS allowlist, Zod-validated DTOs.
- Standard error codes (§65); request IDs on every log line (structured JSON).
- Never trust frontend for money, stock, eligibility, or payment results —
  backend verifies gateway status before finalizing.

## 8. Key engines (interfaces first)

1. **PricingEngine** — stack: base → seller discount → platform offer → coupon
   → payment offer → rewards → final payable (blueprint §41).
2. **Coupon rules engine** — eligibility conditions: min cart, category, brand,
   seller, customer group, payment method, date, location, quantity, new
   customer, membership (§40). `Coupon.conditions` JSONB + server-side eval.
3. **Returns & Refunds** (P1) — see §9.
4. **Rewards ledger** (§21) — immutable `RewardTransaction`; earn rules engine;
   redemption with expiry.
5. **Fraud & risk** — signals → score → allow/review/block (§51).
6. **Recommendations** — similar / FBT / also-viewed / because-you-viewed (§42).
7. **Fulfillment engine** — 5 methods with estimatedTime/fee/availability/
   sellerEligibility/serviceArea (nearby pickup & hyperlocal = NearBuy layer).
8. **Search** — PG now, OpenSearch-compatible abstraction; NL→structured filters.
9. **AI platform** — Frontend → AI API → AI Service → Tools/LLM; grounded-only
   NearAI (never fabricates inventory/delivery).

## 9. Post-purchase (P1 — first deep module)

### Return / replacement state machine (§17, §31)

```
REQUESTED ──► APPROVED ──► PICKUP_SCHEDULED ──► PICKED_UP ──► RECEIVED
    │                                                         │
    └────────► REJECTED                                        ▼
                                                          INSPECTION
                                                          ╱         ╲
                                                   REJECTED      APPROVED
                                                                  ╱      ╲
                                                        REPLACED          REFUND_INITIATED
                                                                                  │
                                                                             REFUNDED (terminal)
```

- `ReturnRequest` (header: type RETURN|REPLACEMENT, reason, policy snapshot)
  with `ReturnItem` per order item (qty, reason, condition notes).
- `ReplacementOrder` links return → original order → new order.
- Eligibility: configurable per category/product (`policy` JSONB: window,
  allowed reasons, restocking fee, replacement availability).
- Refunds run as a **ledger**: `Refund` + `PaymentTransaction` rows; gateway
  verified; original-method first. Seller return handling lives in the seller
  hub against the same state machine.
- `OrderStatusHistory` records every transition with actor; `Invoice` is
  generated per order.

## 10. Realtime & async

- SSE/WebSockets for order/reservation/delivery tracking and live stock hints.
- Job queues (Redis) for emails/notifications, invoice generation, settlement,
  expiry sweeps (reservations, refunds, rewards expiry).
- Redis caching for hot catalog/search — **never** long-lived inventory cache.

## 11. Security & compliance (§67, §51)

HTTPS, secure cookies, CSRF double-submit, rate limiting, Zod validation,
parameterized queries, RBAC + tenancy checks, audit log, secrets server-only,
payment tokenization (never raw card data), webhook signature verification,
fraud hooks on auth/payment/coupon/return/review paths.

## 12. Delivery phases (§79 adapted — post-purchase first)

| Phase | Scope | State |
| --- | --- | --- |
| P0 Foundation | architecture, DB, kernel, 23-service topology, design system | ✅ this doc |
| **P1 Post-purchase** | **returns/replacements/refunds, order status history, invoices, seller return handling** | **next** |
| P2 Commerce frontends | customer web (auth→product→cart→checkout→orders→track), seller hub, admin | after P1 |
| P3 Logistics | warehouses/WMS-lite, shipments & first/last-mile events, control tower | planned |
| P4 Growth | rewards ledger + Plus, coupon rules engine, campaigns/ads | planned |
| P5 Intelligence | recommendations, AI assistant v2, fraud scoring, personalization | planned |
| P6 Ecosystem | Minutes quick-commerce surface, grocery, exchange/recommerce, flights (behind interfaces) | planned |

Quality gates run every phase: typecheck, prod build, migrations, tests
(critical journeys + race conditions), API docs, a11y, SEO, security checklist.
