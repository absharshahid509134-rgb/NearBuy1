-- 2_checkout_idempotency — checkout retry protection + product ownership.
-- Additive only; safe for existing data.

-- ── Checkout idempotency ─────────────────────────────────────────────────────
CREATE TABLE "CheckoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "orderIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckoutRequest_userId_key_unique" ON "CheckoutRequest"("userId", "key");
CREATE INDEX "CheckoutRequest_userId_createdAt_idx" ON "CheckoutRequest"("userId", "createdAt");

ALTER TABLE "CheckoutRequest"
    ADD CONSTRAINT "CheckoutRequest_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Product ownership ────────────────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN "ownerId" TEXT;
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_ownerId_fkey" FOREIGN KEY ("ownerId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
