# NearBuy

**What you need, already nearby.** One website for the people who make neighbourhood commerce work: customers, local sellers and delivery partners.

## Try the unified website

```bash
npm ci
npm run dev            # http://localhost:5173 — interactive preview, no database needed
npm run build          # typecheck + production Vite build
npm run test:portals   # browser-portal smoke tests
npm run test:api       # full API/integration suite (real gateway + throwaway Postgres DB)
npm run test:e2e       # Playwright E2E, desktop + mobile (needs npx playwright install chromium)
```

## Production

The production instance is the compiled gateway (`dist-api/`) serving the static SPA (`dist/`) in one process, with PostgreSQL as the only system of record — stores, products, inventory, orders, reservations, delivery jobs and audit logs are all DB rows and survive restarts. Checkout prices/fees are server-computed, orders are idempotent, and role checks are enforced in the API.

```bash
npm ci --include=dev
node scripts/prisma-generate.mjs   # or: npx prisma generate
npm run build:prod                 # SPA + API bundle
npm run db:migrate                 # needs DATABASE_URL
npm run db:seed                    # optional demo data
node scripts/start-prod.mjs        # or run dist-api/backend/src/main.js with the env vars below
```

Required env: `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `AUTH_SECRET` (≥16 chars), `WEB_URL` + `CORS_ORIGINS` (your public origin — no localhost). Health: `GET /live` `/health` `/ready`. Full runbook, env reference, backup and real-payment (Razorpay) wiring: **`docs/PRODUCTION.md`**.

Open `/` and choose **Customer**, **Seller Hub** or **Rider Hub**. Each has its own sign-in and workspace:

| Portal | Sign in | Your pages |
| --- | --- | --- |
| Customer | `/login/customer` — email/password or phone code | `/customer`, `/search`, `/nearby`, `/stores`, `/cart`, `/orders`, `/account`, etc. |
| Seller Hub | `/login/seller` — business email/password | `/seller`, `/seller/orders`, `/seller/inventory`, `/seller/growth`, `/seller/account`, `/seller/onboarding` |
| Rider Hub | `/login/rider` — email/password | `/rider`, `/rider/jobs`, `/rider/earnings`, `/rider/profile` |

The sign-in tab **does not grant a role**. The server assigns the account role; each route checks the restored session, and signing in through the wrong portal signs that session out and points to the correct sign-in. A customer cannot open seller/rider pages, a seller cannot open customer/rider pages, and a rider cannot open customer/seller pages. Internal staff roles without a matching workspace see an access message instead of being treated as customers or sellers. The existing admin console at `/admin` is still restricted to administrative accounts; it is not a public fourth portal.

### Preview accounts

In the default development preview, choose a portal and click **Fill demo details** (then **Sign in**) or use:

| Portal | Email | Password |
| --- | --- | --- |
| Customer | `customer@nearbuy.dev` | `Customer@123` |
| Seller | `seller.sports@nearbuy.dev` | `Seller@123` |
| Rider | `delivery@nearbuy.dev` | `Delivery@123` |

Customer sign-in can also use a phone code; the preview displays the code instead of sending an SMS. Try joining as a new seller to set up a store, or as a rider to start with an empty earnings history. The two preloaded rider jobs show example codes in Rider Hub; **new orders require real handoffs**: the seller sees the pickup code in their Orders page after marking a parcel packed, and the customer sees the delivery code in their order details once the rider picks it up. Never give the customer code to the store or rider before the doorstep handoff.

**Try the connected loop:** sign in as the customer, add a product from **ABC Sports** (`/product/p1?store=s1`) and place a local delivery order. Sign in as the seller and accept → prepare → pack → mark it ready. Sign in as the rider, accept the matching job and visit the store. Ask the seller for the pickup code, then ask the customer for the drop-off code. Reopen Orders in each workspace (or use **Refresh**) to see the status update. Reserve & Pickup and customer shelf-check requests also reach the seller’s Orders and Inventory pages, respectively. Each store in a multi-store cart receives a separate order and delivery fee. No real payment is taken in preview.

Preview accounts, stock, orders and jobs live **only in development server memory** and reset on restart; don't use the preview API in production. The storefront’s catalog and older sample order history are illustrative. New seller registrations have their own store workspace but are not automatically listed in the seeded customer catalog; ABC Sports (`s1`) is the store connected to the supplied seller account.

### Using the real API instead

Set `NEARBUY_DEMO_AUTH=0` when starting Vite. Requests to the relative `/api/v1` path are then proxied to the existing NestJS gateway on `API_URL` (default `http://127.0.0.1:4000`); browser code never connects to localhost directly. The gateway uses PostgreSQL and the Prisma client. For local full-stack development:

```bash
npm run dev:db                         # separate terminal: embedded PostgreSQL
set -a; source .env.development; set +a
npm run db:migrate
npm run prisma:generate --workspace @nearbuy/database   # requires Prisma engines or an engine-free local setup
npm run db:seed
npm run dev:gateway                    # separate terminal
NEARBUY_DEMO_AUTH=0 npm run dev       # separate terminal
```

The database scripts require `DATABASE_URL` exported in the shell. If your environment cannot download Prisma engines, use the offline generator: `node scripts/prisma-generate.mjs` (it also applies the WASM engine patch required by the engine-free Prisma client). Production serves the API and the static SPA from the same origin and never uses the in-memory preview middleware — the Vite production build does not include it, and the customer marketplace reads its catalog, prices, stock and ETA entirely from the persisted API.

## What works today

- **Customer:** product search and discovery, nearby stores, comparisons, account-scoped cart/wishlist, and customer-owned API orders, reservations and stock-check requests. In the production build, browsing (stores, products, prices, stock, ETA) is served from the persisted API — the `npm run dev` browser-only preview keeps its seeded local catalog for no-database demos. Order statuses refresh from the API, not from another account's browser storage.
- **Seller:** store-specific overview, orders/reservation progression, shelf-check responses, inventory updates, insights, onboarding and an account page with store availability and mobile sign-out. ABC Sports inventory/prices match its seeded storefront listings.
- **Rider:** available/active jobs, accept and advance through pickup and drop-off with role-specific handoff codes, online/offline availability, earnings and profile. A rider cannot collect an order before its seller marks it ready.
- **Security:** server-side role checks for public registration and every portal, seller ownership checks (including private stock requests), atomic job claiming, rider ownership, hidden customer addresses until assignment, and separate pickup/customer handoff secrets. Access and refresh credentials use first-party cookies rather than localStorage in the unified site.

The repository also contains older standalone Next.js apps (`apps/web`, `apps/seller`, `apps/admin`) and the modular NestJS gateway in `backend` / `packages/server-core`. The **root Vite app** (`npm run dev` / `npm run build`) is the unified three-portal website. See `docs/ARCHITECTURE.md` for the wider platform roadmap.
