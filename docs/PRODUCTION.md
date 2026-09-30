# NearBuy — Production Runbook

How to build, deploy and operate the production instance (real PostgreSQL,
real API, static SPA). Verified against the live instance in this session.

## 1. What "production" means here

- **NestJS gateway** (`dist-api/`) — all business logic, auth, role guards,
  rate limits, server-computed prices. Compiled CommonJS; no dev middleware.
- **Static SPA** (`dist/`) — Vite build of the unified Customer/Seller/Rider
  portal. Served by the same process via `NEARBUY_STATIC_DIR` (zero extra
  infrastructure).
- **PostgreSQL** — the only system of record. Every store, product, listing,
  inventory row, order, reservation, delivery job and audit row is a DB row.
  There is no in-memory production state: restart the process and all data
  survives.
- **Files** — product images are stored on local disk (or S3 via
  `STORAGE_DRIVER=s3`) and served through `/images/...`.

## 2. Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` — enables the prod code paths (cookie `Secure` flag follows `WEB_URL`) |
| `PORT` | yes | Gateway listen port (verified at 8080) |
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/nearbuy?schema=public` |
| `AUTH_SECRET` | **yes** | ≥ 16 chars (zod-enforced). Signs session + JWT tokens. Generate: `openssl rand -hex 32` |
| `WEB_URL` | **yes** | Public origin of the site, e.g. `https://nearbuy.example.com`. **No `localhost` in a deployed build** — cookie `Secure`, redirect URLs and CSRF validation derive from it |
| `CORS_ORIGINS` | **yes** | Comma-separated allowed origins (usually `= WEB_URL`) |
| `JWT_ACCESS_TTL` | no | Seconds, default 900 |
| `JWT_REFRESH_TTL` | no | Seconds, default 30 days |
| `OTP_TTL_SECONDS` | no | Default 300 |
| `MAPS_PROVIDER` | no | `haversine` (default, no key) or `google` (+`MAPS_API_KEY`) |
| `PAYMENT_PROVIDER` | no | `mock` (default — UI shows "Test Mode — no real payment") or `razorpay` |
| `PAYMENT_KEY` / `PAYMENT_SECRET` / `PAYMENT_WEBHOOK_SECRET` | with razorpay | Configure in your hosting provider's secret store — never in the repo, never in chat |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` (+bucket/keys/region/endpoint) |
| `SEARCH_PROVIDER` | no | `sql` (default, full-text on PostgreSQL) or `opensearch` |
| `AI_PROVIDER` | no | `grounded` (default — rule engine that never fabricates inventory) or `llm` (+key/model) |
| `SENTRY_DSN`, `LOG_LEVEL` | no | Observability |

Full template: `.env.example`. Set secrets in your hosting provider's
environment/secret UI (Render, Railway, Fly.io, your own VPS `systemd`
`EnvironmentFile`, etc.) — do not paste them into code or chat.

## 3. Build & deploy (from a clean checkout)

```bash
# 1. install (includes dev deps — needed for prisma generate offline patch)
npm ci --include=dev

# 2. generate the Prisma client
#    online:  npx prisma generate
#    offline/air-gapped: node scripts/prisma-generate.mjs
#    (the script also runs scripts/patch-prisma-wasm.mjs, which wires the
#     WASM query engine into the generated client — required for the
#     engineType = "wasm" client on plain Node)

# 3. build SPA + API bundle
npm run build:prod

# 4. schema
npm run db:migrate          # reads DATABASE_URL; idempotent, tracked in _prisma_migrations

# 5. demo data (optional — creates the seeded accounts; see below)
npm run db:seed

# 6. run
NODE_ENV=production PORT=8080 \
  DATABASE_URL='postgresql://user:pass@host:5432/nearbuy?schema=public' \
  AUTH_SECRET='$(openssl rand -hex 32)' \
  WEB_URL='https://your-domain.example' \
  CORS_ORIGINS='https://your-domain.example' \
  NEARBUY_STATIC_DIR="$(pwd)/dist" \
  node dist-api/backend/src/main.js
```

`scripts/start-prod.mjs` wraps step 6 for local operation.

### Seeded demo accounts (after `npm run db:seed`)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@nearbuy.dev` | `Customer@123` |
| Grocery seller (Dwarka Fresh Mart) | `seller.grocery@nearbuy.dev` | `Seller@123` |
| Other sellers | `seller.sports@nearbuy.dev`, `seller.electronics@nearbuy.dev`, `seller.fashion@nearbuy.dev`, `seller.home@nearbuy.dev`, `seller.stationery@nearbuy.dev`, `seller.books@nearbuy.dev` | `Seller@123` |
| Rider | `delivery@nearbuy.dev` | `Delivery@123` |
| Admin | `admin@nearbuy.dev` | `Admin@123` |

Change or delete these for a public deployment — they are demo fixtures.

## 4. Health & operations

| Endpoint | Purpose |
| --- | --- |
| `GET /live` | liveness (no DB) |
| `GET /health` | liveness + DB check |
| `GET /ready` | readiness (DB reachable) |
| `GET /api/docs` | OpenAPI docs (disable in prod if not needed) |

Operate with `systemd` (or your PaaS) + `Restart=always`. The process is
stateless — scale horizontally behind any LB; sessions are cookie/JWT based
and all state is in PostgreSQL.

Backups: `pg_dump` the database (orders, inventory, users) + back up the
image storage directory (or use S3 versioning). Migrations are forward-only
and tracked — always run `npm run db:migrate` on deploy.

## 5. Payments — real gateway wiring

The platform ships with a **`mock` provider by default**. It is *explicit*:
the UI shows "Test Mode — no real payment was taken" on the checkout and on
every success screen, and the stored `PaymentTransaction.kind` is `mock`.
Nothing ever claims a real charge happened.

To go live (Razorpay adapter is included):

1. Create a Razorpay account; note Key ID / Key Secret.
2. Set `PAYMENT_PROVIDER=razorpay`, `PAYMENT_KEY`, `PAYMENT_SECRET`,
   `PAYMENT_WEBHOOK_SECRET` in your host's secret store.
3. Point Razorpay's webhook at `POST /api/v1/payments/webhook` — the gateway
   verifies the signature with `PAYMENT_WEBHOOK_SECRET` and marks the
   payment paid only on a verified `payment.captured` event.
4. The checkout intent flow (`POST /api/v1/payments/intents`) already
   returns provider credentials; no frontend change needed beyond removing
   the Test Mode banner when `PAYMENT_PROVIDER !== 'mock'`.

COD (`COD`) and pay-at-store pickup (`PAY_AT_STORE`) remain available
independently — no gateway involvement.

## 6. Security posture (enforced, not aspirational)

- **Passwords** — bcrypt-hashed; never returned by any endpoint
  (verified by test: raw DB hash round-trips `bcrypt.compareSync`).
- **Sessions** — httpOnly `nb_at` cookie (secure-flagged when `WEB_URL` is
  https), CSRF double-submit (`nb_csrf` cookie + `X-CSRF-Token` header) on
  all mutating requests.
- **Rate limits** — global 300 req/min/IP; login 20/min, register 10/min,
  OTP 10/min; 429s in the standard error envelope.
- **Roles** — `@Roles` + `RolesGuard` on every controller; cross-role
  requests return 403 (verified: rider/seller cannot place checkouts;
  customers cannot open seller/rider portals or APIs).
- **Server-side price/stock** — checkout re-reads product + inventory from
  the DB; client-supplied prices are ignored; over-stock returns
  `409 OUT_OF_STOCK`; idempotency keys prevent duplicate orders on retry
  (same key + different cart → `409 IDEMPOTENCY_MISMATCH`).
- **State machines** — seller can only advance orders
  pending→confirmed→preparing→packed→ready; delivery completion is rider-only
  and code-verified (seller pickup code, customer handoff code).

## 7. Tests

```bash
npm run test:api     # API/integration — real gateway + throwaway nearbuy_test DB
npm run test:portals # browser-portal smoke (node:test)
npm run test:e2e     # Playwright E2E (desktop 1366×768 + mobile 390×844)
                     # requires: npx playwright install chromium + a running
                     # production build (E2E_BASE_URL=... defaults to :8080)
```

## 8. Known limitations (honest list)

- Playwright **browsers could not be downloaded in this sandbox** (CDN
  blocked) — the E2E suite is written, type-checked and CI-ready, but was
  not executed here. The full three-role journey was instead verified end to
  end against the live production build via the API/integration suite and
  scripted HTTP checks (see session report).
- `mock` payments by default — real money movement requires the Razorpay
  wiring in §5.
- Local disk storage by default — switch to S3 for multi-instance deploys.
- No horizontal cache (Redis optional) — fine at neighbourhood scale.
