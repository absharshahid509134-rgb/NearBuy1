/**
 * Portal shell components: header (search, location, account, cart), footer,
 * locale switcher. Client-side; auth-aware via @nearbuy/api session store.
 */
'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from './index'
import { initLocale, s, switchLocale, LOCALES, currentLocale, type Locale } from './strings'
import { Badge, Button, Input } from './primitives'
import { useSession, useLogout, loadMe, type MeView } from '@nearbuy/api'

export function useBootstrapSession(): MeView | null {
  const { user, checked, setUser, setChecked } = useSession()
  React.useEffect(() => {
    initLocale()
    if (!checked) void loadMe(setUser, setChecked)
  }, [checked, setUser, setChecked])
  return user
}

export function SearchBar({ defaultValue = '', className }: { defaultValue?: string; className?: string }) {
  const router = useRouter()
  const [q, setQ] = React.useState(defaultValue)
  return (
    <form
      role="search"
      className={cn('flex flex-1 items-center gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
      }}
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={s('search.placeholder', 'Search products, brands, stores…')}
        aria-label={s('nav.search', 'Search')}
        className="rounded-full"
      />
      <Button type="submit" size="sm" className="h-11 rounded-full px-5" aria-label={s('nav.search', 'Search')}>
        🔍
      </Button>
    </form>
  )
}

export function LocaleSwitcher() {
  const cur = currentLocale()
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {LOCALES.map((l: Locale) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={cn('rounded-full px-2 py-0.5 text-xs font-bold uppercase', cur === l ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-neutral-100')}
          aria-pressed={cur === l}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export function AreaPill() {
  const [area, setArea] = React.useState('Dwarka Sector 22')
  React.useEffect(() => {
    setArea(localStorage.getItem('nb_area') ?? 'Dwarka Sector 22')
  }, [])
  return (
    <button
      className="flex max-w-[180px] items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-100"
      onClick={() => {
        const next = window.prompt(s('location.prompt', 'Set your area'), area)
        if (next) {
          localStorage.setItem('nb_area', next)
          setArea(next)
        }
      }}
      aria-label={s('location.change', 'Change location')}
    >
      📍 <span className="truncate">{area}</span>
    </button>
  )
}

export function SiteHeader({ variant = 'customer' }: { variant?: 'customer' | 'seller' | 'admin' }) {
  const user = useBootstrapSession()
  const logout = useLogout()
  const home = variant === 'seller' ? '/seller' : variant === 'admin' ? '/admin' : '/'
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href={home} className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight text-primary-600">NEARBUY</span>
          <span className="hidden text-[11px] font-bold uppercase tracking-widest text-accent-600 sm:block">
            {variant === 'seller' ? s('seller.title', 'Seller Hub') : variant === 'admin' ? s('admin.title', 'Admin') : s('brand.tagline', 'What You Need, Already Nearby.')}
          </span>
        </Link>
        {variant === 'customer' && <SearchBar className="mx-2 hidden md:flex" />}
        <div className="ml-auto flex items-center gap-2">
          {variant === 'customer' && <AreaPill />}
          <LocaleSwitcher />
          {user ? (
            <>
              {variant === 'customer' && (
                <>
                  <Link href="/notifications" className="rounded-full p-2 hover:bg-neutral-100" aria-label={s('nav.notifications', 'Notifications')}>🔔</Link>
                  <Link href="/wishlist" className="rounded-full p-2 hover:bg-neutral-100" aria-label={s('nav.wishlist', 'Wishlist')}>♡</Link>
                  <Link href="/cart" className="relative rounded-full p-2 hover:bg-neutral-100" aria-label={s('nav.cart', 'Cart')}>
                    🛒
                  </Link>
                </>
              )}
              <Link href={variant === 'customer' ? '/account' : home} className="hidden items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-sm font-semibold text-ink sm:flex">
                👤 <span className="max-w-[110px] truncate">{user.name}</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>{s('auth.signOut', 'Sign out')}</Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-ink-secondary hover:text-primary-600">{s('auth.signIn', 'Sign in')}</Link>
              <Link href="/signup">
                <Button size="sm" variant="accent">{s('auth.signUp', 'Sign up')}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
      {variant === 'customer' && (
        <nav className="border-t border-border bg-canvas" aria-label={s('nav.primary', 'Primary')}>
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-sm font-semibold text-ink-secondary">
            {[
              ['/', s('nav.home', 'Home')],
              ['/search?q=deals', s('nav.deals', 'Deals')],
              ['/stores', s('nav.stores', 'Stores')],
              ['/orders', s('nav.orders', 'Orders')],
              ['/reservations', s('nav.reservations', 'Reservations')],
              ['/wishlist', s('nav.wishlist', 'Wishlist')],
              ['/help', s('nav.help', 'Help')],
              ['/seller', s('home.becomeSeller', 'Become a Seller')],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1 hover:bg-white hover:text-primary-600">
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-primary-600">NEARBUY</p>
          <p className="mt-1 text-sm text-ink-muted">{s('brand.productLine', 'Search Online. Find Nearby. Reserve. Pickup. Deliver.')}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{s('nav.shop', 'Shop')}</p>
          <ul className="space-y-1 text-sm text-ink-secondary">
            <li><Link href="/search" className="hover:text-primary-600">{s('nav.search', 'Search')}</Link></li>
            <li><Link href="/stores" className="hover:text-primary-600">{s('nav.stores', 'Stores')}</Link></li>
            <li><Link href="/search?q=deals" className="hover:text-primary-600">{s('nav.deals', 'Deals')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{s('nav.account', 'Account')}</p>
          <ul className="space-y-1 text-sm text-ink-secondary">
            <li><Link href="/orders" className="hover:text-primary-600">{s('nav.orders', 'Orders')}</Link></li>
            <li><Link href="/reservations" className="hover:text-primary-600">{s('nav.reservations', 'Reservations')}</Link></li>
            <li><Link href="/help" className="hover:text-primary-600">{s('nav.help', 'Help')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{s('footer.partners', 'Partners')}</p>
          <ul className="space-y-1 text-sm text-ink-secondary">
            <li><Link href="/seller" className="hover:text-primary-600">{s('home.becomeSeller', 'Become a Seller')}</Link></li>
            <li><Link href="/admin" className="hover:text-primary-600">{s('admin.title', 'Admin')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} NearBuy · {s('footer.tag', 'Local commerce, connected.')}
      </div>
    </footer>
  )
}

