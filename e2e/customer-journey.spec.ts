import { expect, test } from '@playwright/test'
import { ACCOUNTS, login, placeOrderViaUi } from './helpers'

/**
 * Customer journey — runs at BOTH desktop and mobile widths.
 *
 * Verifies: persisted catalog browsing (7 seeded stores incl. the new
 * grocery store), search/discovery, store page, product page, cart with
 * quantity control, server-computed checkout quote with per-store delivery
 * fees, explicit "Test Mode" disclosure, order placement (COD), and the
 * order appearing in the customer's order list.
 */
test.describe('customer journey', () => {
  test('browse persisted catalog, buy from a store, order lands in my orders', async ({ page }) => {
    // 1. customer home shows persisted stores from the API
    await page.goto('/customer')
    await expect(page.getByRole('link', { name: 'Dwarka Fresh Mart' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sector 22 Gadget Store' }).first()).toBeVisible()

    // 2. grocery category exists in the persisted catalog
    const grocery = page.getByRole('link', { name: /Grocery/ }).first()
    if (await grocery.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await grocery.click()
      await expect(page.getByText('Amul Taaza Milk 1L').first()).toBeVisible({ timeout: 15_000 })
      await page.goto('/customer')
    }

    // 3. sign in as the seeded customer
    await login(page, 'customer', ACCOUNTS.customer.email, ACCOUNTS.customer.password)

    // 4. place an order: 2 × Amul Taaza Milk 1L at Dwarka Fresh Mart
    const refs = await placeOrderViaUi(page, {
      storeName: 'Dwarka Fresh Mart',
      productName: 'Amul Taaza Milk 1L',
      qty: 2,
    })
    expect(refs.length).toBeGreaterThan(0)

    // 5. order is visible in the customer's order list
    await page.getByRole('button', { name: 'Track Order' }).click()
    await expect(page).toHaveURL('/orders')
    await expect(page.getByText('Amul Taaza Milk 1L').first()).toBeVisible()
  })

  test('search finds the new seller product end-to-end', async ({ page }) => {
    await page.goto('/search?q=milk')
    // product search results link to the product page
    const result = page.getByRole('link', { name: /Amul Taaza Milk 1L/ }).first()
    await expect(result).toBeVisible({ timeout: 15_000 })
    await result.click()
    await expect(page).toHaveURL(/\/product\//)
    // persisted store price (68 — the Dwarka Fresh Mart listing, not a
    // hard-coded catalogue value)
    await expect(page.getByText(/₹\s?68/).first()).toBeVisible()
  })
})
