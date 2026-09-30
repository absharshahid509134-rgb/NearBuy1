# NearBuy Mobile (React Native / Expo) — future apps

The backend API (`/api/v1`) and `@nearbuy/types` + `@nearbuy/validation` packages are designed
for reuse by three mobile apps:

```text
apps/mobile/customer   — Customer App
apps/mobile/seller     — Seller App
apps/mobile/delivery   — Delivery Partner App
```

Rules already enforced server-side so mobile stays thin:

- Authentication via email/password + phone/OTP, JWT access + refresh tokens
  (mobile clients receive tokens in the JSON response instead of cookies).
- All input validated with shared Zod schemas (`@nearbuy/validation`).
- Inventory, pricing and fulfillment decisions never trusted from any client.
- Provider abstractions (maps/payments/search/notifications) mean mobile uses the
  same contracts as web.

Bootstrap later with:

```bash
npx create-expo-app apps/mobile/customer -t expo-template-blank-typescript
```
