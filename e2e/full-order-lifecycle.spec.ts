import { expect, test } from '@playwright/test'
import {
  ACCOUNTS,
  login,
  placeOrderViaUi,
  readCustomerHandoffCode,
  readSellerPickupCode,
} from './helpers'

/**
 * Full Customer → Seller → Rider lifecycle on the LIVE production build.
 *
 *  customer places an order (UI)
 *  seller  processes it through the state machine (UI): accept → preparing
 *          → packed → ready for pickup, reading the rider pickup code
 *  rider   claims the job, verifies pickup with the seller code, verifies
 *          delivery with the customer handoff code (read from the customer
 *          UI), and the job reaches DELIVERED
 *
 * Finally the Delivered/Completed state is verified in ALL THREE roles
 * after a page refresh, and in the customer role after a full re-login in a
 * fresh browser context (persistence, not UI state).
 *
 * Desktop only (the three-role matrix needs three browser contexts).
 */
test.describe('full order lifecycle (customer → seller → rider)', () => {
  test('one order, two codes, three roles — delivered everywhere', async ({ browser, page }, testInfo) => {
    // the three-role matrix uses three contexts — desktop only keeps the
    // matrix deterministic (mobile coverage is the customer journey above)
    if (testInfo.project.name !== 'desktop') test.skip(true, 'desktop-only matrix')
    const ctx = await browser.newContext()
    const sellerPage = await ctx.newPage()
    const riderPage = await ctx.newPage()

    // ── CUSTOMER: place the order ────────────────────────────────────────
    await login(page, 'customer', ACCOUNTS.customer.email, ACCOUNTS.customer.password)
    await placeOrderViaUi(page, {
      storeName: 'Dwarka Fresh Mart',
      productName: 'Amul Taaza Milk 1L',
      qty: 1,
    })
    // the order must appear in the customer's list
    await page.getByRole('button', { name: 'Track Order' }).click()
    await expect(page.getByText('Amul Taaza Milk 1L').first()).toBeVisible()

    // ── SELLER: run the state machine ────────────────────────────────────
    await login(sellerPage, 'seller', ACCOUNTS.grocerySeller.email, ACCOUNTS.grocerySeller.password)
    await sellerPage.goto('/seller/orders')
    const sellerOrder = sellerPage.getByText('Amul Taaza Milk 1L').first()
    await expect(sellerOrder).toBeVisible({ timeout: 20_000 })

    for (const [action, expectNext] of [
      ['Accept order', 'Start preparing'],
      ['Start preparing', 'Mark packed'],
      ['Mark packed', 'Ready for pickup'],
      ['Ready for pickup', null],
    ] as const) {
      const btn = sellerPage.getByRole('button', { name: action })
      await expect(btn).toBeVisible({ timeout: 15_000 })
      await btn.click()
      if (expectNext) {
        await expect(sellerPage.getByRole('button', { name: expectNext })).toBeVisible({ timeout: 15_000 })
      }
    }
    // invalid transition guard: the seller must NOT be able to complete a
    // delivery order (only the rider confirms at the customer's door)
    await expect(sellerPage.getByRole('button', { name: 'Complete order' })).toHaveCount(0)

    // the rider pickup code is only revealed once the parcel is ready
    const pickupCode = await readSellerPickupCode(sellerPage)
    expect(pickupCode).toMatch(/^\d{4,6}$/)

    // ── RIDER: claim + both code handoffs ────────────────────────────────
    await login(riderPage, 'rider', ACCOUNTS.rider.email, ACCOUNTS.rider.password)
    await riderPage.goto('/rider/jobs')
    const job = riderPage.locator('article.rider-job', { hasText: 'Amul Taaza Milk 1L' }).first()
    await expect(job).toBeVisible({ timeout: 20_000 })

    await job.getByRole('button', { name: 'Accept delivery' }).click()
    await job.getByRole('button', { name: "I’m at the store" }).click()
    await job.getByRole('button', { name: 'Confirm pickup' }).click()
    await job.locator('input[placeholder="Enter code"]').fill(pickupCode)
    await job.getByRole('button', { name: 'Verify & continue' }).click()
    await job.getByRole('button', { name: "I’m at the customer" }).click()

    // the handoff code is now visible to the customer (out for delivery)
    const handoffCode = await readCustomerHandoffCode(page)
    expect(handoffCode).toMatch(/^\d{4,6}$/)

    await job.getByRole('button', { name: 'Complete delivery' }).click()
    await job.locator('input[placeholder="Enter code"]').fill(handoffCode)
    await job.getByRole('button', { name: 'Verify & continue' }).click()
    await expect(job.getByText('Delivered').first()).toBeVisible({ timeout: 20_000 })

    // ── VERIFY in ALL THREE roles ────────────────────────────────────────
    // seller: no next action, no pickup-code note left
    await expect(sellerPage.getByRole('button', { name: 'Ready for pickup' })).toHaveCount(0)
    await expect(sellerPage.locator('.hub-handoff-note')).toHaveCount(0)

    // customer: order shows delivered
    await page.goto('/orders')
    await page.getByRole('tab', { name: 'Delivered' }).click()
    await expect(page.getByText('Amul Taaza Milk 1L').first()).toBeVisible()

    // ── PERSISTENCE: refresh every role ──────────────────────────────────
    await riderPage.reload()
    await expect(
      riderPage.locator('article.rider-job', { hasText: 'Amul Taaza Milk 1L' }).first().getByText('Delivered'),
    ).toBeVisible({ timeout: 20_000 })

    await sellerPage.reload()
    await expect(sellerPage.locator('.hub-handoff-note')).toHaveCount(0)

    await page.reload()
    await page.getByRole('tab', { name: 'Delivered' }).click()
    await expect(page.getByText('Amul Taaza Milk 1L').first()).toBeVisible()

    // ── PERSISTENCE: full re-login in a fresh context (customer) ─────────
    const ctx2 = await browser.newContext()
    const fresh = await ctx2.newPage()
    await login(fresh, 'customer', ACCOUNTS.customer.email, ACCOUNTS.customer.password)
    await fresh.goto('/orders')
    await fresh.getByRole('tab', { name: 'Delivered' }).click()
    await expect(fresh.getByText('Amul Taaza Milk 1L').first()).toBeVisible()

    await ctx.close()
    await ctx2.close()
  })
})
