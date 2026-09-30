import React from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Bell,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  MapPin,
  Package,
  QrCode,
  Search,
  ShoppingCart,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  TrendingUp,
  CircleHelp,
  User,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { LocationChip, ToastHost } from './ui'
import { CUSTOMER_LOCATION } from '../data/catalog'
import { Brand } from './Brand'
import { SignOutButton } from './SignOutButton'
import { useAuth } from '../auth/AuthContext'
import { homeForUser } from '../auth/portals'
import { useSeller } from '../seller/SellerContext'

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const { user } = useAuth()
  return <Brand light={light} compact={compact} to={user ? homeForUser(user) : '/'} />
}

/* ── Customer header (desktop) + mobile header ──────────── */
const headerLinks = [
  { to: '/customer', label: 'Shop' },
  { to: '/explore', label: 'Categories' },
  { to: '/nearby', label: 'Nearby' },
  { to: '/deals', label: 'Deals' },
  { to: '/stores', label: 'Stores' },
]

export function CustomerHeader() {
  const { cartCount, wishlist } = useApp()
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="nb-container-wide hidden lg:flex h-[72px] items-center gap-6">
        <Logo />
        <div className="flex-1 max-w-xl">
          <Link
            to="/search"
            className="flex items-center gap-3 h-14 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-500 hover:shadow-search transition-shadow duration-normal"
          >
            <Search size={22} className="text-neutral-400" />
            <span>Search products, brands, stores…</span>
          </Link>
        </div>
        <nav className="flex items-center gap-1">
          {headerLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-3 h-11 flex items-center rounded-md text-body-sm font-semibold transition-colors duration-fast ${
                  isActive ? 'text-primary-600 bg-primary-50' : 'text-neutral-600 hover:bg-neutral-50'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1 ml-2">
          <NavLink
            to="/orders"
            className="px-3 h-11 flex items-center rounded-md text-body-sm font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Orders
          </NavLink>
          <NavLink
            to="/wishlist"
            className="w-11 h-11 flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-50 relative"
            aria-label="Wishlist"
          >
            <Heart size={22} />
            {wishlist.length > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-deal text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/cart"
            className="w-11 h-11 flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-50 relative"
            aria-label="Cart"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/account"
            className="w-11 h-11 flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-50"
            aria-label="Account"
          >
            <User size={22} />
          </NavLink>
        </div>
      </div>

      {/* mobile header */}
      <div className="lg:hidden h-16 flex items-center gap-3 px-4">
        <span className="customer-mobile-brand"><Logo /></span>
        <div className="flex-1 min-w-0 customer-mobile-location">
          <LocationChip label={CUSTOMER_LOCATION.label} />
        </div>
        <Link to="/orders" className="w-11 h-11 flex items-center justify-center text-neutral-600 relative" aria-label="Orders and updates">
          <Bell size={22} />
        </Link>
        <NavLink to="/account" className="w-11 h-11 flex items-center justify-center text-neutral-600" aria-label="Profile">
          <User size={22} />
        </NavLink>
      </div>
    </header>
  )
}

/* ── Mobile bottom nav ──────────────────────────────────── */
const bottomNav = [
  { to: '/customer', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/nearby', icon: MapPin, label: 'Nearby' },
  { to: '/orders', icon: Package, label: 'Orders' },
  { to: '/account', icon: User, label: 'You' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-[76px]">
        {bottomNav.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link key={to} to={to} className="flex flex-col items-center justify-center gap-1 min-h-touch">
              <span
                className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-fast ${
                  active ? 'bg-primary-50' : ''
                }`}
              >
                <Icon size={24} className={active ? 'text-primary-500' : 'text-neutral-500'} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={`text-[11px] font-semibold ${active ? 'text-primary-500' : 'text-neutral-500'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/* ── Footer ─────────────────────────────────────────────── */
const footerCols = [
  {
    title: 'Shop',
    links: [
      ['Search', '/search'],
      ['Nearby Stores', '/nearby'],
      ['Deals', '/deals'],
      ['Reservations', '/reservations'],
    ],
  },
  {
    title: 'Your space',
    links: [
      ['Orders', '/orders'],
      ['Wishlist', '/wishlist'],
      ['Your cart', '/cart'],
      ['Your account', '/account'],
    ],
  },
  {
    title: 'Sell locally',
    links: [
      ['Seller sign in', '/login/seller'],
      ['Bring your store online', '/join/seller'],
      ['Local makers', '/local-market'],
    ],
  },
  {
    title: 'Deliver locally',
    links: [
      ['Rider sign in', '/login/rider'],
      ['Become a rider', '/join/rider'],
    ],
  },
  {
    title: 'Discover',
    links: [
      ['Explore categories', '/explore'],
      ['Nearby stores', '/stores'],
      ['Ask NearAI', '/nearai'],
      ['Track orders', '/orders'],
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-white mt-20">
      <div className="nb-container-wide py-12 hidden md:block">
        <div className="grid grid-cols-6 gap-8">
          <div className="col-span-1">
            <Logo light />
            <p className="text-body-sm text-neutral-300 mt-4">
              What You Need, Already Nearby.
            </p>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <p className="text-body-sm font-semibold mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-body-sm text-neutral-300 hover:text-white transition-colors duration-fast">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-700 mt-10 pt-6 text-caption text-neutral-400">
          © 2026 NearBuy · Search Online · Find Nearby · Reserve · Pickup · Deliver
        </div>
      </div>
      {/* compact mobile footer */}
      <div className="md:hidden px-4 py-6 flex flex-wrap gap-x-4 gap-y-2 text-caption text-neutral-300">
        <Link to="/stores">Stores</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/reservations">Pickups</Link>
        <Link to="/account">Your account</Link>
        <Link to="/login/seller">Seller Hub</Link>
        <Link to="/login/rider">Rider Hub</Link>
        <span className="w-full text-neutral-500 mt-2">© 2026 NearBuy</span>
      </div>
    </footer>
  )
}

/* ── Customer shell ─────────────────────────────────────── */
export function CustomerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <CustomerHeader />
      <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      <Footer />
      <BottomNav />
      <ToastHost />
    </div>
  )
}

/* ── Seller shell: a private workspace, never a shortcut into other roles ── */
const sellerNav = [
  { to: '/seller', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/seller/orders', icon: Package, label: 'Orders', end: false },
  { to: '/seller/inventory', icon: ShoppingBag, label: 'Inventory', end: false },
  { to: '/seller/growth', icon: TrendingUp, label: 'Insights', end: false },
  { to: '/seller/account', icon: User, label: 'Account', end: false },
]

export function SellerShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { profile } = useSeller()
  const store = profile?.stores[0]
  return (
    <div className="hub-shell seller-shell">
      <aside className="hub-sidebar seller-sidebar">
        <div className="hub-sidebar-brand"><Brand to="/seller" /><span className="hub-sidebar-tag">SELLER HUB</span></div>
        <p className="hub-sidebar-section">YOUR WORKSPACE</p>
        <nav aria-label="Seller navigation">{sellerNav.map(({ to, icon: Icon, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `hub-side-link ${isActive ? 'active' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
        <div className="hub-sidebar-bottom"><div className="hub-sidebar-help"><CircleHelp size={18} /><strong>Made for local.</strong><p>Everything your shop needs to serve the neighbourhood better.</p></div><SignOutButton className="hub-side-logout" /></div>
      </aside>
      <div className="hub-main">
        <header className="hub-topbar"><div className="hub-topbar-mobile-brand"><Brand to="/seller" compact /><strong>Seller Hub</strong></div><div className="hub-topbar-title"><span className="hub-topbar-category">NEARBUY / SELLER HUB</span><strong>{store?.name || 'Set up your store'}</strong></div><div className="hub-topbar-actions"><span className="hub-location"><MapPin size={15} /> {store?.area || 'Your neighbourhood'}</span>{store && <span className={`hub-online-pill ${store.verified ? '' : 'offline'}`}><span />{store.verified ? 'Verified store' : 'New store'}</span>}<Link to="/seller/account" className="hub-avatar" aria-label="Store and account settings">{user?.name.charAt(0) || 'S'}</Link></div></header>
        <main className="hub-main-content">{children}</main>
        <nav className="hub-mobile-nav" aria-label="Seller navigation">{sellerNav.map(({ to, icon: Icon, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
      </div>
      <ToastHost />
    </div>
  )
}

/* ── Admin shell ────────────────────────────────────────── */
const adminNav = [
  { to: '/admin', label: 'Overview', end: true, icon: LayoutDashboard },
  { to: '/admin/radar', label: 'Demand Radar', icon: Compass },
  { to: '/admin/directory', label: 'People & Stores', icon: StoreIcon },
  { to: '/admin/ops', label: 'Operations', icon: Truck },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="hidden lg:flex flex-col w-64 bg-neutral-900 text-white sticky top-0 h-screen">
        <div className="h-[72px] flex items-center px-5 border-b border-neutral-700">
          <Logo light />
          <span className="ml-2 text-caption bg-primary-700 px-2 py-0.5 rounded-full">ADMIN</span>
        </div>
        <nav className="p-3 space-y-1">
          {adminNav.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 px-4 rounded-md text-body-sm font-semibold transition-colors duration-fast ${
                  isActive ? 'bg-primary-600 text-white' : 'text-neutral-300 hover:bg-neutral-800'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-neutral-700">
          <SignOutButton className="flex items-center gap-2 text-body-sm text-neutral-300 hover:text-white min-h-touch" />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 h-[72px] flex items-center gap-4 px-4 lg:px-8">
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="font-bold">City Command Center · Delhi</div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-2 text-caption font-semibold text-success-600 bg-success-50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse" /> All systems normal
            </span>
            <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center">
              NB
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8 space-y-6">
          <div className="lg:hidden flex gap-2 nb-scroll-x pb-2">
            {adminNav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-4 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap ${
                    isActive ? 'bg-primary-500 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          {children}
        </div>
      </div>
      <ToastHost />
    </div>
  )
}

export function AppShellSwitch({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/* quick link row used on account page */
export function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="nb-card flex items-center gap-3 px-4 py-3.5 hover:shadow-medium transition-shadow duration-normal min-h-touch"
    >
      <span className="text-primary-500">{icon}</span>
      <span className="text-body-sm font-semibold text-neutral-800">{label}</span>
    </Link>
  )
}

export { QrCode, MapPin }
