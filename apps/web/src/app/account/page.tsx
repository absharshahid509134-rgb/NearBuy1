'use client'
import * as React from 'react'
import Link from 'next/link'
import { useSession, useAddresses, useLogout } from '@nearbuy/api'
import { Card, Button, EmptyState, LoadingBlock, Badge, s } from '@nearbuy/ui'

const MENU = [
  { href: '/orders', icon: '📦', key: 'nav.orders', label: 'Orders' },
  { href: '/reservations', icon: '📍', key: 'nav.reservations', label: 'Reservations' },
  { href: '/wishlist', icon: '♡', key: 'nav.wishlist', label: 'Wishlist' },
  { href: '/notifications', icon: '🔔', key: 'nav.notifications', label: 'Notifications' },
  { href: '/help', icon: '💬', key: 'nav.help', label: 'Help & Support' },
  { href: '/seller', icon: '🏪', key: 'home.becomeSeller', label: 'Become a Seller' },
]

export default function AccountPage() {
  const { user, checked } = useSession()
  const { data: addresses } = useAddresses()
  const logout = useLogout()

  if (!checked) return <LoadingBlock />
  if (!user) return <div className="nb-container py-10"><EmptyState title={s('auth.signInRequired', 'Please sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>

  return (
    <div className="nb-container grid gap-6 py-6 lg:grid-cols-[320px,1fr]">
      <Card className="h-fit p-5">
        <p className="text-xl font-extrabold text-ink">{user.name}</p>
        <Badge tone="info" className="mt-2">{user.role.replaceAll('_', ' ')}</Badge>
        <Button variant="outline" className="mt-4 w-full" onClick={() => logout.mutate()}>{s('auth.signOut', 'Sign out')}</Button>
      </Card>
      <section>
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s('account.title', 'Your account')}</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href}>
              <Card className="flex items-center gap-3 p-4 hover:border-primary-300">
                <span aria-hidden className="text-2xl">{m.icon}</span>
                <span className="font-bold text-ink">{s(m.key, m.label)}</span>
              </Card>
            </Link>
          ))}
        </div>
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-extrabold text-ink">{s('account.addresses', 'Saved addresses')}</h2>
          {(addresses ?? []).length === 0 && <p className="text-sm text-ink-muted">{s('account.noAddresses', 'No saved addresses yet.')}</p>}
          <ul className="space-y-2">
            {(addresses ?? []).map((a) => (
              <li key={a.id} className="rounded-card bg-canvas p-3 text-sm">
                <span className="font-bold">{a.label}</span> — {a.line1}, {a.area}, {a.city} {a.pincode}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}
