# NearBuy — Database Design

PostgreSQL + Prisma. Schema: `packages/database/prisma/schema.prisma` (source of
truth). Migrations: `packages/database/prisma/migrations/` (hand-authored SQL,
Prisma-migrate naming conventions — `Model_pkey`, `Model_a_b_key`, `Model_a_idx`,
`Model_field_fkey`). Runner: `scripts/migrate.ts` (records `_prisma_migrations`
with sha256 checksums). Dev DB: embedded Postgres via `scripts/dev-db.ts`
(`./.pgdata`, port 5432, DBs `nearbuy` + `nearbuy_test`).

## Blueprint → schema map (§54/§55)

| Blueprint table | NearBuy model | Notes |
| --- | --- | --- |
| users / user_profiles | `User` + `CustomerProfile` | roles per ARCHITECTURE §6 |
| user_addresses | `Address` | snapshotted onto orders |
| user_sessions | `RefreshToken` | rotating refresh tokens |
| sellers / seller_profiles | `Seller` | KYC/verified flags |
| seller_documents / seller_accounts | `SellerDocument` / `SellerAccount` | P3 |
| products / product_variants / product_images | `Product` / `ProductVariant` / `ProductImage` | slug SEO routes |
| product_attributes | `Product.specs` JSONB | attribute table P3 if needed |
| brands / categories | `Brand` / `Category` | tree via parentId |
| seller_products | `Inventory` row (store×product[×variant]) | multi-seller = rows across stores; carries listing `price` |
| inventory / stock_movements | `Inventory` / `StockMovement` | `available = quantity − reservedQuantity` |
| warehouses | `Warehouse` | WMS nodes beyond shops (P3) |
| carts / cart_items | `Cart` / `CartItem` | multi-store baskets |
| wishlists / wishlist_items | `Wishlist` / `WishlistItem` | |
| orders / order_items | `Order` / `OrderItem` | multi-store split at checkout |
| order_status_history | `OrderStatusHistory` | every transition + actor |
| payments / payment_transactions | `Payment` / `PaymentTransaction` | gateway ledger |
| refunds | `Refund` | + gatewayRef/completedAt |
| shipments / shipment_events | `Fulfillment` + `Delivery` / `DeliveryEvent` | 5-method fulfillment engine |
| delivery_partners | `DeliveryPartner` | |
| returns / return_items | `ReturnRequest` / `ReturnItem` | state machine in ARCHITECTURE §9 |
| replacement_orders | `ReplacementOrder` | |
| reviews / review_media | `Review` / `ReviewMedia` | verified-purchase only |
| questions / answers | `Question` / `Answer` | P1 |
| coupons / coupon_rules | `Coupon` (+`conditions` JSONB) / `CouponProduct` | rules engine P1 |
| promotions | `Promotion` | |
| advertisements / campaigns | `Advertisement` / `Campaign` | P4 |
| rewards / reward_transactions | `RewardWallet` / `RewardTransaction` | **immutable ledger** |
| notifications | `Notification` | multi-channel events |
| support_tickets / support_messages | `SupportTicket` / `SupportMessage` | |
| search_events | `SearchQuery` | |
| click_events / analytics_events | `ClickEvent` / `AnalyticsEvent` | funnel §61 |
| fraud_events / risk_decisions | `FraudEvent` | decision on the event |
| — (NearBuy layer) | `Reservation` + `ReservationItem`, `StockConfirmRequest`, `InventoryReservation`, `InventoryAudit`, `InventorySync`, `Price` | reserve & pickup, live stock confirmation |

## Invariants

1. **No overselling.** Stock mutations only via `InventoryService`
   (conditional `updateMany` where `availableQuantity >= qty`) inside
   transactions; `InventoryReservation` holds reserved stock with expiries.
2. **Rewards are a ledger.** `RewardTransaction` rows are append-only;
   `RewardWallet.balance` is updated only in the same transaction as an append.
   Never set balances directly.
3. **Money** is `DECIMAL(10,2)` with a single `currency` (INR) at Price level.
   Payment/fulfillment/order statuses are **separate state machines**.
4. **Prices & offers** are server-computed at checkout; totals snapshotted on
   `Order` (subtotal/deliveryFee/discount/total + addressSnap + couponCode).
5. **Statuses are strings with documented machines** (Reservation uses Prisma
   enums; returns/orders/payments/deliveries use validated string states) so new
   states can roll out without enum migrations.

## Migrations

| File | Scope |
| --- | --- |
| `0_init` | core 34 models (catalog, commerce, reservations, payments, base post-purchase) |
| `1_storefront_blueprint` | Storefront expansion: order_status_history, invoices, return_items, replacement_orders, payment_transactions, warehouses, stock_movements, reward_wallets/transactions, campaigns, advertisements, questions/answers, review_media, fraud_events, support_messages, click_events, analytics_events; `ReturnRequest`/`Refund`/`Coupon` columns; 6 new roles |

## Seed (`packages/database/prisma/seed.ts`, spec §92)

Wipe-and-reload demo dataset: 13 users, 6 stores around Dwarka Sector 22
(28.5921, 77.046), 12 products with realistic prices, per-store inventory,
coupons `WELCOME10` / `NEARBUY50`, promotions, 2 orders
(`NB-DEMO-1001/1002`), 3 reservations (`NB-4417/2210/7788`).

**Demo accounts**

| Account | Password | Role |
| --- | --- | --- |
| customer@nearbuy.dev | `Customer@123` | customer (Aarav Sharma) |
| meera@nearbuy.dev | `Customer@123` | customer |
| seller.sports@nearbuy.dev … seller.home@nearbuy.dev | `Seller@123` | 6 sellers/6 stores |
| admin@nearbuy.dev | `Admin@123` | product/admin |
| support@nearbuy.dev | `Support@123` | support |
| delivery@nearbuy.dev | `Delivery@123` | delivery partner (Arjun Rider) |

## Local dev

```bash
node scripts/dev-db.ts        # embedded Postgres (background)
DATABASE_URL=… node scripts/migrate.ts
DATABASE_URL=… npx tsx packages/database/prisma/seed.ts
```
