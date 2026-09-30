'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminMetrics, useSession } from '@nearbuy/api'
import { useBootstrapSession, Card, Button, EmptyState, LoadingBlock, s, formatINR, SectionHeader } from '@nearbuy/ui'

const SECTIONS = [
  ['/admin/users', '👥', 'admin.users', 'Users'],
  ['/admin/sellers', '🏪', 'admin.sellers', 'Sellers & KYC'],
  ['/admin/orders', '📦', 'nav.orders', 'Orders'],
  ['/admin/reservations', '📍', 'nav.reservations', 'Reservations'],
  ['/admin/demand-radar', '📡', 'admin.demandRadar', 'Demand Radar'],
  ['/admin/audit-logs', '🧾', 'admin.auditLogs', 'Audit logs'],
]

export default function AdminHome() {
  useBootstrapSession()
  const router = useRouter()
  const { user, checked } = useSession()
  const { data, isLoading } = useAdminMetrics()

  React.useEffect(() => {
    if (checked && (!user || !user.role.includes('ADMIN'))) router.push('/login')
  }, [checked, user, router])

  if (!checked) return <LoadingBlock />
  if (!user || !user.role.includes('ADMIN')) {
    return <div className="nb-container py-10"><EmptyState title={s('admin.signIn', 'Admin sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>
  }

  const cards = data
    ? [
        [s('admin.users', 'Users'), String(data.users)],
        [s('admin.sellers', 'Sellers'), String(data.sellers)],
        [s('admin.stores', 'Stores'), String(data.stores)],
        [s('admin.products', 'Products'), String(data.products)],
        [s('nav.orders', 'Orders'), String(data.orders)],
        [s('nav.reservations', 'Reservations'), String(data.reservations)],
        [s('admin.gmv', 'GMV'), formatINR(Number(data.gmv))],
        [s('admin.aov', 'AOV'), formatINR(Number(data.aov))],
      ]
    : []

  return (
    <div className="nb-container py-6">
      <SectionHeader title={s('admin.title', 'Admin')} />
      {isLoading ? <LoadingBlock /> : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {SECTIONS.map(([href, icon, key, label]) => (
          <Link key={href} href={href}>
            <Card className="flex items-center gap-3 p-4 hover:border-primary-300">
              <span className="text-2xl" aria-hidden>{icon}</span>
              <span className="font-bold text-ink">{s(key, label)}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
