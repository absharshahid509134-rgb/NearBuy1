'use client'
import * as React from 'react'
import Link from 'next/link'
import { useNotifications, useMarkNotificationsRead, useSession, type NotificationRow } from '@nearbuy/api'
import { Card, Button, EmptyState, LoadingBlock, Badge, s, SectionHeader } from '@nearbuy/ui'

export default function NotificationsPage() {
  const { user, checked } = useSession()
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationsRead()

  if (!checked) return <LoadingBlock />
  if (!user) return <div className="nb-container py-10"><EmptyState title={s('auth.signInRequired', 'Please sign in')} action={<Link href="/login"><Button>{s('auth.signIn', 'Sign in')}</Button></Link>} /></div>

  const rows: NotificationRow[] = Array.isArray(data) ? data : ((data as { items?: NotificationRow[] })?.items ?? [])

  return (
    <div className="nb-container max-w-3xl py-6">
      <SectionHeader
        title={s('nav.notifications', 'Notifications')}
        action={<Button variant="outline" size="sm" onClick={() => markRead.mutate()}>{s('notifications.markAll', 'Mark all read')}</Button>}
      />
      {isLoading ? <LoadingBlock /> : rows.length === 0 ? (
        <EmptyState title={s('notifications.empty', 'All caught up')} hint={s('notifications.emptyHint', 'Order updates, price drops and reservation alerts land here.')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={`p-4 ${n.read ? 'opacity-70' : 'border-primary-300'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink">{n.title}</p>
                  <Badge tone="neutral">{n.type}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-secondary">{n.body}</p>
                <p className="mt-1 text-xs text-ink-muted">{new Date(n.createdAt).toLocaleString()}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
