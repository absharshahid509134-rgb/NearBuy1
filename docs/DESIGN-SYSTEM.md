# NearBuy — Design System (condensed)

**Brand line:** What You Need, Already Nearby.
**Product line:** Search Online. Find Nearby. Reserve. Pickup. Deliver.

**Direction:** Modern + Local + Fast + Trustworthy + Simple + Smart. Every screen must make
**availability, location, price and fulfillment** understandable within a few seconds.

> One-sentence rule: *NearBuy should always make availability, location, price and fulfillment
> visually understandable within a few seconds.*

## Color

| Role | Token | HEX |
| --- | --- | --- |
| Primary (NearBlue) | `primary.500` | `#2563EB` (hover `#1D4ED8`, pressed `#1E40AF`, soft bg `#EFF6FF`) |
| Sky / discovery | `sky.500` | `#0EA5E9` (Nearby Blue `#0284C7`) |
| Success / available | `success.500` | `#16A34A` |
| Warning | `warning.500` | `#F59E0B` |
| Error | `error.500` | `#DC2626` |
| Info | `info.500` | `#0284C7` |
| Fast | `fast` | `#EA580C` |
| Reserve & Pickup | `reserve` | `#7C3AED` (surface `#F5F3FF`, border `#DDD6FE`) |
| Deals | `deal` | `#E11D48` (sparingly) |
| Text / headings | `neutral.900` | `#0F172A` (never pure black) |
| Body | `neutral.600` | `#475569` |
| Background / card | `neutral.50` / `neutral.0` | `#F8FAFC` / `#FFFFFF` |
| Border | `neutral.200` | `#E2E8F0` |

Neutrals are blue-tinted (25→900 scale in `tailwind.config.ts`). Color ratio ≈ 70% neutral,
20% blue/sky, 5% green, 3% orange, 2% other.

## Typography

**Plus Jakarta Sans** everywhere (Noto Sans Devanagari fallback for Indic);
**Inter** only for dense seller/admin data (`.font-data`).

Scale (desktop / mobile): Display XL 64/72 · Display LG 56 · Display MD 48 · H1 40/28 ·
H2 32/24 · H3 24/20 · H4 20 · H5 18 · Body-LG 18 · Body 16/15 · Body-SM 14/13 · Caption 12.
Weights: 400/500/600/700/800 only. Prices: 20–28px, weight 700, tabular numerals.
Price hierarchy: current 22px/700 · old 14px strikethrough · savings 13px/600 success.

## Layout & spacing

8-point spacing (4/8/12/16/24/32/40/48/64/80/96/120). Desktop max 1440px, ideal 1200–1280px,
12-col grid (24px gutter); tablet 8-col; mobile 4-col, 16px padding. Breakpoints: xs<480 ·
sm 480 · md 768 · lg 1024 · xl 1280 · 2xl ≥1536.

## Shape & elevation

Radii: 4 tiny · 8 small · 10 inputs/buttons · 12 small cards · **16 primary cards & search** ·
20 modals · 24 hero/bottom sheets · 999 pills. Shadows are soft only:
`0 1px 3px rgba(15,23,42,.06)` / `0 4px 12px …(.08)` / `0 12px 32px …(.10)`.

## Components

- **Buttons**: 48px standard (44 md, 36 sm, 56 hero CTA), radius 10–12. Primary blue · secondary
  white/border · soft `#EFF6FF` · success (Confirm Reservation, Mark Ready) · danger ·
  **reserve purple** for Reserve & Pickup CTAs.
- **Search bar**: 56px desktop / 52px mobile, radius 16, rotating placeholders
  (“Try ‘school bag under ₹1500’” …).
- **Badges** — the NearBuy visual signature: 📍 **1.4 km Nearby** (`#EFF6FF`/`#1D4ED8`) ·
  ⚡ **45 min** (`#FFF7ED`/`#C2410C`) · ✓ In Stock (green) · Low Stock (amber) · Out of Stock (red) ·
  Ready for Pickup (blue) · 📦 Reserve (purple) · ✓ Verified Store.
- **Fulfillment selector** (visual heart of product page): 🚚 Standard · ⚡ Fast · 🏪 Pickup ·
  🛵 Local Delivery · 📦 Reserve & Pickup — selected card: 2px `#2563EB` border + `#EFF6FF` fill.
- **Reservation card** (purple surface): QR + pickup code + window + expiry; purple primary button.
- **Tables** (seller/admin): header `#F8FAFC` 12/700, rows 56–64px, hover `#F8FAFC`.
- **Dashboards**: metric card = 13/600 label · 32/800 number · change + supporting caption;
  minimal line/bar/area charts, light `#E2E8F0` grid.
- **Navigation**: desktop header 72px; mobile header 64px + bottom nav 72–80px
  (Home · Search · Nearby · Orders · You; active = `#2563EB` + `#EFF6FF` capsule, label 11/600).
  Seller sidebar 240px (active `#EFF6FF` + 4px left bar); **admin sidebar 256px on `#0F172A`**.
- **Maps stay quiet**: light neutral base; stores `#2563EB`, selected `#1D4ED8`, customer `#0F172A`,
  routes `#2563EB`.
- **Empty states** always have illustration + heading 20/700 + body 14 + action. Loading = subtle
  skeletons. Toasts: top-right desktop / above bottom nav mobile.

## Motion & accessibility

150ms fast · 200ms normal · 250ms modal · 250–300ms page; `ease-out`/`ease-in-out`. Animate state
change only. WCAG AA contrast; status is never color-only (icon + text). Touch targets ≥44px
(preferred 48). Dark mode spec exists (`#0B1220` bg) for later — light is default.

## Voice

Short + direct + friendly. “Reservation confirmed.” · “How do you want to get it?” ·
“Delivering to Dwarka”. Buttons: Buy Now · Reserve · Pickup Today · Compare Options ·
Confirm Reservation — never “Click Here”/“Submit”. Store closed = “Closed now · Opens at 9:00 AM”.
Reservation microcopy: Reserve this item → Waiting for store confirmation → Your item is booked →
Packed → Ready for pickup → Show this QR code at the store.

*Digest of the full NearBuy UI/UX design system (123 sections). Tokens are implemented in
`tailwind.config.ts`, `src/index.css` and `src/components/ui.tsx`.*
