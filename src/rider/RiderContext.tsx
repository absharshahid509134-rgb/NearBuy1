import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../auth/api'
import { useAuth } from '../auth/AuthContext'

export type JobStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'AT_STORE'
  | 'PICKED_UP'
  | 'AT_CUSTOMER'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED'
export interface RiderJob {
  id: string
  number: string
  status: JobStatus
  fee: number
  distanceKm: number
  packageCount: number
  pickup: { name: string; area: string; address: string } | null
  drop?: string | null
  items: { name: string; qty: number }[]
}
interface JobsResponse {
  available: RiderJob[]
  active: RiderJob[]
}
export interface RiderEarnings {
  balance: number
  completed: number
  recent: { order: string; fee: number }[]
}
export interface RiderPerformance {
  rating: number
  deliveries: number
  zone: string
  available: boolean
  vehicle?: string
}
interface RiderState {
  available: RiderJob[]
  active: RiderJob[]
  earnings: RiderEarnings | null
  performance: RiderPerformance | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  accept: (jobId: string) => Promise<void>
  advance: (jobId: string, status: JobStatus, code?: string) => Promise<void>
  setAvailable: (available: boolean) => Promise<void>
}
const Context = createContext<RiderState | null>(null)

export function RiderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [available, setJobsAvailable] = useState<RiderJob[]>([])
  const [active, setActive] = useState<RiderJob[]>([])
  const [earnings, setEarnings] = useState<RiderEarnings | null>(null)
  const [performance, setPerformance] = useState<RiderPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [jobs, money, stats] = await Promise.all([
        api.get<JobsResponse>('/delivery/jobs'),
        api.get<RiderEarnings>('/delivery/earnings'),
        api.get<RiderPerformance>('/delivery/performance'),
      ])
      setJobsAvailable(jobs.available)
      setActive(jobs.active)
      setEarnings(money)
      setPerformance(stats)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your deliveries.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void refresh()
    const onReturn = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onReturn)
    return () => document.removeEventListener('visibilitychange', onReturn)
  }, [user?.id])

  const value = useMemo<RiderState>(
    () => ({
      available,
      active,
      earnings,
      performance,
      loading,
      error,
      refresh,
      accept: async (jobId) => {
        await api.post(`/delivery/jobs/${encodeURIComponent(jobId)}/accept`)
        await refresh()
      },
      advance: async (jobId, status, code) => {
        await api.post(`/delivery/${encodeURIComponent(jobId)}/events`, { status, ...(code ? { code } : {}) })
        await refresh()
      },
      setAvailable: async (online) => {
        await api.patch('/delivery/availability', { available: online })
        await refresh()
      },
    }),
    [available, active, earnings, performance, loading, error],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useRider(): RiderState {
  const context = useContext(Context)
  if (!context) throw new Error('useRider must be inside RiderProvider')
  return context
}
