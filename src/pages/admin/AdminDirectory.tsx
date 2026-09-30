import { useEffect, useState } from 'react'
import { api } from '../../auth/api'
import { storeDistance } from '../../lib/geo'
import { formatKm } from '../../lib/format'
import { SectionHeading, StatusBadge, Tabs } from '../../components/ui'
import { useCatalog } from '../../store/CatalogContext'

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  locationLabel: string | null
}

const roleBadge = (status: string): 'stock' | 'low' | 'ready' | 'out' => {
  if (status === 'ACTIVE') return 'stock'
  if (status === 'SUSPENDED') return 'out'
  return 'ready'
}

export default function AdminDirectory() {
  const [tab, setTab] = useState<'users' | 'sellers' | 'delivery'>('users')
  const { stores, status: catalogStatus } = useCatalog()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .get<AdminUser[]>('/admin/users')
      .then((u) => {
        if (live) setUsers(u)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [])

  const customers = (users ?? []).filter((u) => u.role === 'CUSTOMER')
  const riders = (users ?? []).filter((u) => u.role === 'DELIVERY_PARTNER')
  const storeCount = catalogStatus === 'ready' ? stores.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-m-h1 lg:text-h2 font-bold">People & Stores</h1>
        <p className="text-body-sm text-neutral-500 mt-1">Registered users, stores and delivery partners from the database.</p>
      </div>

      {error && (
        <div className="nb-card p-4 border-warning-200 bg-warning-50 text-sm text-warning-800">
          Directory unavailable: {error}
        </div>
      )}

      <Tabs<'users' | 'sellers' | 'delivery'>
        tabs={[
          { id: 'users', label: 'Customers', count: users ? customers.length : undefined },
          { id: 'sellers', label: 'Stores', count: catalogStatus === 'ready' ? storeCount : undefined },
          { id: 'delivery', label: 'Delivery Partners', count: users ? riders.length : undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'users' && (
        <div className="nb-card overflow-x-auto">
          <table className="w-full min-w-[640px] nb-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold text-neutral-900">{u.name}</td>
                  <td>{u.email}</td>
                  <td className="font-data text-caption">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <StatusBadge kind={roleBadge(u.status)}>{u.status}</StatusBadge>
                  </td>
                </tr>
              ))}
              {!users && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-400 py-6">Loading users…</td>
                </tr>
              )}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-400 py-6">No registered customers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sellers' && (
        <div className="nb-card overflow-x-auto">
          <table className="w-full min-w-[760px] nb-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Area</th>
                <th>Distance</th>
                <th>Rating</th>
                <th>Verification</th>
                <th>Fulfilment</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-neutral-900">
                    {s.emoji} {s.name}
                  </td>
                  <td>{s.area}</td>
                  <td className="font-data">{formatKm(storeDistance(s))}</td>
                  <td className="font-data">★ {s.rating}</td>
                  <td>
                    <StatusBadge kind={s.verified ? 'stock' : 'low'}>{s.verified ? '✓ Verified' : 'Pending docs'}</StatusBadge>
                  </td>
                  <td className="text-caption">
                    {s.pickup ? 'Pickup ' : ''}
                    {s.localDelivery ? '· Local delivery' : ''}
                  </td>
                </tr>
              ))}
              {catalogStatus !== 'ready' && (
                <tr>
                  <td colSpan={6} className="text-center text-neutral-400 py-6">Loading stores…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'delivery' && (
        <div className="nb-card overflow-x-auto">
          <table className="w-full min-w-[640px] nb-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {riders.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold text-neutral-900">{u.name}</td>
                  <td>{u.email}</td>
                  <td className="font-data text-caption">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <StatusBadge kind={roleBadge(u.status)}>{u.status}</StatusBadge>
                  </td>
                </tr>
              ))}
              {!users && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-400 py-6">Loading partners…</td>
                </tr>
              )}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-neutral-400 py-6">No registered delivery partners yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
