import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { BarChart3, Bike, CircleHelp, Compass, LayoutDashboard, MapPin, UserRound } from 'lucide-react'
import { Brand } from '../components/Brand'
import { SignOutButton } from '../components/SignOutButton'
import { useAuth } from '../auth/AuthContext'
import { useRider } from './RiderContext'

const nav = [
  { to: '/rider', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/rider/jobs', label: 'Deliveries', icon: Bike },
  { to: '/rider/earnings', label: 'Earnings', icon: BarChart3 },
  { to: '/rider/profile', label: 'My profile', icon: UserRound },
]

export function RiderShell({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { performance } = useRider()
  return (
    <div className="hub-shell rider-shell">
      <aside className="hub-sidebar rider-sidebar">
        <div className="hub-sidebar-brand">
          <Brand light to="/rider" />
          <span className="hub-sidebar-tag">RIDER HUB</span>
        </div>
        <p className="hub-sidebar-section">YOUR WORKSPACE</p>
        <nav aria-label="Rider navigation">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `hub-side-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hub-sidebar-bottom">
          <div className="hub-sidebar-help">
            <CircleHelp size={18} />
            <strong>Ride safely, always.</strong>
            <p>Take breaks when you need them. Your wellbeing comes first.</p>
          </div>
          <SignOutButton className="hub-side-logout" />
        </div>
      </aside>
      <div className="hub-main">
        <header className="hub-topbar">
          <div className="hub-topbar-mobile-brand">
            <Brand to="/rider" compact />
            <strong>Rider Hub</strong>
          </div>
          <div className="hub-topbar-title">
            <span className="hub-topbar-category">NEARBUY / RIDER HUB</span>
            <strong>Your neighbourhood, your route.</strong>
          </div>
          <div className="hub-topbar-actions">
            <span className="hub-location">
              <MapPin size={15} /> {performance?.zone || 'Dwarka'}
            </span>
            <span className={`hub-online-pill ${performance?.available ? '' : 'offline'}`}>
              <span />
              {performance?.available ? 'Online' : 'Offline'}
            </span>
            <span className="hub-avatar">{user?.name?.charAt(0) || 'R'}</span>
          </div>
        </header>
        <main className="hub-main-content">{children}</main>
        <nav className="hub-mobile-nav" aria-label="Rider navigation">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} end={end} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
