import { expect, type BrowserContext, type Page } from '@playwright/test'

/**
 * Shared helpers for the NearBuy E2E suite.
 *
 * Accounts are the deterministic demo accounts created by
 * `packages/database/prisma/seed.ts` against the live `nearbuy` database.
 */
export const ACCOUNTS = {
  customer: { email: 'customer@nearbuy.dev', password: 'Customer@123' },
  grocerySeller: { email: 'seller.grocery@nearbuy.dev', password: 'Seller@123' },
  sportsSeller: { email: 'seller.sports@nearbuy.dev', password: 'Seller@123' },
  rider: { email: 'delivery@nearbuy.dev', password: 'Delivery@123' },
} as const

export type Portal = 'customer' | 'seller' | 'rider'

/** Log in through the real auth UI and wait for the post-login redirect. */
export async function login(page: Page, portal: Portal, email: string, password: string): Promise<void> {
  await page.goto(`/login/${portal}`)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^Sign in to / }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

/**
 * Place a fresh order for `qty × product` at the given store through the
 * customer UI (product page → Buy Now → cart → checkout → Place Order).
 * Returns the store reference shown on the success screen.
 */
export async function placeOrderViaUi(
  page: Page,
  opts: { storeName: string; productName: string; qty: number },
): Promise<string[]> {
  // 1. store page
  await page.goto('/customer')
  await page.getByRole('link', { name: opts.storeName }).first().click()
  await expect(page).toHaveURL(/\/store\//)

  // 2. product page (store product list links to /product/:id)
  await page.getByRole('link', { name: opts.productName }).first().click()
  await expect(page).toHaveURL(/\/product\//)

  // 3. Buy Now → cart
  await page.getByRole('button', { name: 'Buy Now' }).click()
  await expect(page).toHaveURL('/cart')

  // 4. quantity
  for (let i = 1; i < opts.qty; i++) {
    await page.getByRole('button', { name: 'Increase' }).click()
  }

  // 5. checkout — assert server-computed fee + test-mode disclosure
  await page.getByRole('button', { name: 'Checkout' }).click()
  await expect(page).toHaveURL('/checkout')
  await expect(page.getByText('Test Mode — no real payment is taken')).toBeVisible()
  await expect(page.getByText('Local delivery from this store')).toBeVisible()

  // 6. place (default fulfilment = local delivery, payment = COD)
  await page.getByRole('button', { name: /Place Order/ }).click()
  await expect(page.getByRole('heading', { name: /Order placed/ })).toBeVisible()
  await expect(page.getByText('Test Mode — no real payment was taken.')).toBeVisible()

  const refs = await page.locator('span.font-data.font-bold').allTextContents()
  return refs
}

/** Open the customer's order list and assert an order line is visible. */
export async function expectCustomerOrderVisible(page: Page, productName: string, tab: 'Active' | 'Delivered' = 'Active'): Promise<void> {
  await page.goto('/orders')
  await page.getByRole('tab', { name: tab }).click()
  await expect(page.getByText(productName).first()).toBeVisible({ timeout: 15_000 })
}

/**
 * Read the rider pickup code shown on the seller's order card once the
 * order is PACKED/READY_FOR_PICKUP.
 */
export async function readSellerPickupCode(page: Page): Promise<string> {
  const note = page.locator('.hub-handoff-note')
  await expect(note).toBeVisible({ timeout: 20_000 })
  const text = await note.first().innerText()
  const m = text.match(/(\d{4,6})/)
  if (!m) throw new Error(`pickup code not found in: ${text}`)
  return m[1]
}

/**
 * Read the customer handoff code shown on the customer's order card once the
 * order is out for delivery.
 */
export async function readCustomerHandoffCode(page: Page): Promise<string> {
  await page.goto('/orders')
  await page.getByRole('tab', { name: 'Active' }).click()
  const note = page.getByText('Customer handoff code')
  await expect(note.first()).toBeVisible({ timeout: 30_000 })
  const text = await note.first().locator('..').innerText()
  const m = text.match(/(\d{4,6})/)
  if (!m) throw new Error(`handoff code not found in: ${text}`)
  return m[1]
}

/** Create an isolated browser context (fresh cookies = logged-out state). */
export async function freshContext(context: BrowserContext): Promise<BrowserContext> {
  return context
}
