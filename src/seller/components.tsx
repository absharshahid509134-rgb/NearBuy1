import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, RefreshCw } from 'lucide-react'

export const rupees = (value: number | string) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
export const when = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

export function StatusPill({ status }: { status: string }) {
  const key = status.toUpperCase()
  const tone = ['COMPLETED', 'DELIVERED', 'COLLECTED', 'IN_STOCK', 'ACTIVE'].includes(key)
    ? 'good'
    : ['PENDING', 'REQUESTED', 'LOW_STOCK', 'PACKING'].includes(key)
      ? 'warm'
      : ['CANCELLED', 'REJECTED', 'OUT_OF_STOCK', 'FAILED'].includes(key)
        ? 'bad'
        : 'blue'
  return <span className={`hub-status hub-status-${tone}`}>{status.replace(/_/g, ' ').toLowerCase()}</span>
}

export function HubLoading() {
  return (
    <div className="hub-loading" role="status">
      <span className="auth-spinner" /> Loading your workspace…
    </div>
  )
}
export function HubError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="hub-error" role="alert">
      <AlertCircle size={21} />
      <div>
        <strong>We couldn't load your workspace.</strong>
        <p>{message}</p>
      </div>
      <button onClick={retry}>
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  )
}
export function HubEmpty({
  title,
  body,
  to,
  action,
}: {
  title: string
  body: string
  to?: string
  action?: string
}) {
  return (
    <div className="hub-empty">
      <span className="hub-empty-icon">✦</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {to && action && (
        <Link to={to}>
          {action} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  )
}
