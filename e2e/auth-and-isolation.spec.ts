import { expect, test } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

/**
 * Auth + role isolation at the browser level.
 *
 *  - unauthenticated access to a role portal is redirected to the login UI
 *  - wrong credentials are rejected with a visible error (no session)
 *  - a signed-in role that does not own a portal cannot open it
 *  - the API enforces roles server-side even from a valid session
 *    (rider cannot quote/place checkout, seller cannot)
 */
test.describe('auth & role isolation', () => {
  test('unauthenticated portal access redirects to login', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop') test.skip(true, 'desktop-only matrix')
    await page.goto('/seller/orders')
    await expect(page).toHaveURL(/\/login\//)
    await page.goto('/rider/jobs')
    await expect(page).toHaveURL(/\/login\//)
  })

  test('wrong password is rejected with an error, no session created', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop') test.skip(true, 'desktop-only matrix')
    await page.goto('/login/customer')
    await page.locator('input[type="email"]').fill(ACCOUNTS.customer.email)
    await page.locator('input[type="password"]').fill('WrongPassword@1')
    await page.getByRole('button', { name: /^Sign in to / }).click()
    await expect(page.locator('[role="alert"]').first()).toBeVisible()
    await expect(page).toHaveURL('/login/customer') // still on the login page
  })

  test('a signed-in customer cannot open the seller or rider portals', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop') test.skip(true, 'desktop-only matrix')
    await login(page, 'customer', ACCOUNTS.customer.email, ACCOUNTS.customer.password)
    await page.goto('/seller/orders')
    // either bounced back to the customer home or shown the right-portal error
    const onSeller = await page.getByText('Accept order').first().isVisible().catch(() => false)
    expect(onSeller).toBe(false)
    await page.goto('/rider/jobs')
    const riderUi = await page.getByRole('button', { name: 'Accept delivery' }).first().isVisible().catch(() => false)
    expect(riderUi).toBe(false)
  })

  test('API enforces role server-side from a valid session', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop') test.skip(true, 'desktop-only matrix')
    await login(page, 'rider', ACCOUNTS.rider.email, ACCOUNTS.rider.password)
    // rider session → checkout quote must be 403
    const quote = await page.request.post('/api/v1/checkout/quote', {
      data: { items: [], fulfillment: 'NEARBY_PICKUP' },
    })
    expect(quote.status()).toBe(403)
    // rider session → seller admin surface must be 403
    const seller = await page.request.get('/api/v1/sellers/me')
    expect(seller.status()).toBe(403)

    const sellerCtx = await page.context().newPage()
    await login(sellerCtx, 'seller', ACCOUNTS.grocerySeller.email, ACCOUNTS.grocerySeller.password)
    const q2 = await sellerCtx.request.post('/api/v1/checkout/quote', {
      data: { items: [], fulfillment: 'NEARBY_PICKUP' },
    })
    expect(q2.status()).toBe(403)
    await sellerCtx.close()
  })
})
