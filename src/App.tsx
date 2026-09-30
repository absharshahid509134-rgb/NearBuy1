import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { AppProvider } from './store/AppContext'
import { CatalogProvider } from './store/CatalogContext'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { canAccess, homeForUser, type Portal } from './auth/portals'
import { AdminShell, CustomerShell, SellerShell } from './components/layout'
import { SellerProvider, useSeller } from './seller/SellerContext'
import { RiderProvider } from './rider/RiderContext'
import { RiderShell } from './rider/RiderShell'
import { HubLoading } from './seller/components'
import { Brand } from './components/Brand'
import { SignOutButton } from './components/SignOutButton'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import Home from './pages/Home'
import SearchPage from './pages/Search'
import Explore from './pages/Explore'
import Nearby from './pages/Nearby'
import NearbyNow from './pages/NearbyNow'
import Stores from './pages/Stores'
import ProductPage from './pages/ProductPage'
import StorePage from './pages/StorePage'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Reservations from './pages/Reservations'
import Wishlist from './pages/Wishlist'
import Deals from './pages/Deals'
import LocalMarket from './pages/LocalMarket'
import NearAI from './pages/NearAI'
import Account from './pages/Account'
import SellerDashboard from './pages/seller/SellerDashboard'
import SellerOrders from './pages/seller/SellerOrders'
import SellerInventory from './pages/seller/SellerInventory'
import SellerGrowth from './pages/seller/SellerGrowth'
import SellerAccount from './pages/seller/SellerAccount'
import SellerOnboarding from './pages/seller/SellerOnboarding'
import RiderDashboard from './pages/rider/RiderDashboard'
import RiderJobs from './pages/rider/RiderJobs'
import RiderEarnings from './pages/rider/RiderEarnings'
import RiderProfile from './pages/rider/RiderProfile'
import AdminOverview from './pages/admin/AdminOverview'
import AdminRadar from './pages/admin/AdminRadar'
import AdminDirectory from './pages/admin/AdminDirectory'
import AdminOps from './pages/admin/AdminOps'

/** Selected tab only chooses the sign-in form. The server's user.role, restored
 * from its httpOnly cookie, determines which workspace can actually render. */
function RequirePortal({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { user, checking } = useAuth()
  const location = useLocation()
  if (checking)
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f9fc]">
        <HubLoading />
      </div>
    )
  if (!user)
    return (
      <Navigate
        to={`/login/${portal}?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  if (!canAccess(user, portal)) return <Navigate to={homeForUser(user)} replace />
  return <>{children}</>
}

function CustomerLayout() {
  return (
    <RequirePortal portal="customer">
      <CustomerShell>
        <Outlet />
      </CustomerShell>
    </RequirePortal>
  )
}
function AdminLayout() {
  return (
    <RequirePortal portal="admin">
      <AdminShell>
        <Outlet />
      </AdminShell>
    </RequirePortal>
  )
}

function SellerArea() {
  const { profile, needsOnboarding, loading } = useSeller()
  const { pathname } = useLocation()
  if (loading && !profile && !needsOnboarding)
    return (
      <SellerShell>
        <HubLoading />
      </SellerShell>
    )
  if (needsOnboarding && pathname !== '/seller/onboarding')
    return <Navigate to="/seller/onboarding" replace />
  if (profile && pathname === '/seller/onboarding') return <Navigate to="/seller" replace />
  return (
    <SellerShell>
      <Routes>
        <Route index element={<SellerDashboard />} />
        <Route path="orders" element={<SellerOrders />} />
        <Route path="inventory" element={<SellerInventory />} />
        <Route path="growth" element={<SellerGrowth />} />
        <Route path="account" element={<SellerAccount />} />
        <Route path="onboarding" element={<SellerOnboarding />} />
        <Route path="*" element={<Navigate to="/seller" replace />} />
      </Routes>
    </SellerShell>
  )
}
function RiderArea() {
  return (
    <RiderShell>
      <Routes>
        <Route index element={<RiderDashboard />} />
        <Route path="jobs" element={<RiderJobs />} />
        <Route path="earnings" element={<RiderEarnings />} />
        <Route path="profile" element={<RiderProfile />} />
        <Route path="*" element={<Navigate to="/rider" replace />} />
      </Routes>
    </RiderShell>
  )
}

function UnknownRoute() {
  const { user, checking } = useAuth()
  if (checking) return <HubLoading />
  return <Navigate to={user ? homeForUser(user) : '/'} replace />
}

function UnavailableAccount() {
  const { user, checking } = useAuth()
  if (checking) return <HubLoading />
  if (!user) return <Navigate to="/" replace />
  if (homeForUser(user) !== '/unavailable') return <Navigate to={homeForUser(user)} replace />
  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="auth-wrap">
          <Brand />
        </div>
      </header>
      <main className="auth-wrap unavailable-account">
        <div className="auth-form-inner">
          <p className="auth-overline">WORKSPACE ACCESS</p>
          <h1>We don’t have a workspace for this account yet.</h1>
          <p className="auth-intro">
            This account can’t access the customer, seller or rider portals. Contact your NearBuy
            administrator to get access to the right workspace.
          </p>
          <div className="unavailable-signout">
            <SignOutButton className="auth-submit" />
          </div>
        </div>
      </main>
    </div>
  )
}

function PortalRoutes() {
  const { user } = useAuth()
  return (
    <AppProvider key={user?.id ?? 'visitor'} namespace={user?.id ?? 'visitor'}>
      <CatalogProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login/:portal" element={<AuthPage mode="login" />} />
        <Route path="/join/:portal" element={<AuthPage mode="join" />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/unavailable" element={<UnavailableAccount />} />
        <Route path="/seller/login" element={<Navigate to="/login/seller" replace />} />
        <Route path="/rider/login" element={<Navigate to="/login/rider" replace />} />
        <Route path="/shop" element={<Navigate to="/customer" replace />} />

        <Route element={<CustomerLayout />}>
          <Route path="/customer" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/nearby-now" element={<NearbyNow />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/store/:id" element={<StorePage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/local-market" element={<LocalMarket />} />
          <Route path="/nearai" element={<NearAI />} />
          <Route path="/account" element={<Account />} />
        </Route>

        <Route
          path="/seller/*"
          element={
            <RequirePortal portal="seller">
              <SellerProvider>
                <SellerArea />
              </SellerProvider>
            </RequirePortal>
          }
        />
        <Route
          path="/rider/*"
          element={
            <RequirePortal portal="rider">
              <RiderProvider>
                <RiderArea />
              </RiderProvider>
            </RequirePortal>
          }
        />

        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/radar" element={<AdminRadar />} />
          <Route path="/admin/directory" element={<AdminDirectory />} />
          <Route path="/admin/ops" element={<AdminOps />} />
        </Route>
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
      </CatalogProvider>
    </AppProvider>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <PortalRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
