import React from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { useApp } from '../store/AppContext'

/* ── Button ─────────────────────────────────────────────── */
type BtnVariant = 'primary' | 'secondary' | 'soft' | 'success' | 'danger' | 'ghost' | 'reserve'
type BtnSize = 'sm' | 'md' | 'lg' | 'xl'

const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-soft',
  secondary: 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50',
  soft: 'bg-primary-50 text-primary-600 hover:bg-primary-100',
  success: 'bg-success-500 text-white hover:bg-success-600 shadow-soft',
  danger: 'bg-error-500 text-white hover:bg-error-600',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
  reserve: 'bg-reserve text-white hover:bg-[#6D28D9] shadow-soft',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-md',
  md: 'h-11 px-4 text-[15px] rounded-md',
  lg: 'h-12 px-5 text-body rounded-md',
  xl: 'h-14 px-6 text-[17px] rounded-md',
}

export function Button({
  variant = 'primary',
  size = 'lg',
  className = '',
  loading,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-fast min-h-touch disabled:opacity-50 disabled:pointer-events-none ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ── Badges ─────────────────────────────────────────────── */
export function NearbyBadge({ km, className = '' }: { km: string | number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 text-caption font-semibold ${className}`}
    >
      📍 {typeof km === 'number' ? `${km.toFixed(1)} km` : km} Nearby
    </span>
  )
}

export function FastBadge({ mins, className = '' }: { mins: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF7ED] text-fast text-caption font-semibold ${className}`}
    >
      ⚡ {mins}
    </span>
  )
}

export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success-50 text-success-600 text-caption font-semibold ${className}`}
    >
      ✓ Verified Store
    </span>
  )
}

const stockStyles: Record<string, string> = {
  stock: 'bg-success-50 text-success-600',
  low: 'bg-warning-50 text-warning-700',
  out: 'bg-error-50 text-error-600',
  ready: 'bg-primary-50 text-primary-600',
  reserved: 'bg-reservebg text-[#6D28D9]',
  closed: 'bg-neutral-100 text-neutral-500',
}

export function StatusBadge({
  kind = 'stock',
  children,
  className = '',
}: {
  kind?: keyof typeof stockStyles | string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-semibold ${stockStyles[kind] ?? stockStyles.stock} ${className}`}
    >
      {children}
    </span>
  )
}

export function ReserveBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-reservebg text-[#6D28D9] text-caption font-semibold ${className}`}
    >
      📦 Reserve
    </span>
  )
}

/* ── Location chip ──────────────────────────────────────── */
export function LocationChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-primary-50 text-primary-600 text-body-sm font-semibold hover:bg-primary-100 transition-colors duration-fast min-h-touch"
    >
      📍 {label}
    </button>
  )
}

/* ── Section heading ────────────────────────────────────── */
export function SectionHeading({
  title,
  sub,
  action,
  onAction,
  className = '',
}: {
  title: string
  sub?: string
  action?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-4 ${className}`}>
      <div>
        <h2 className="nb-section-title">{title}</h2>
        {sub && <p className="nb-section-sub">{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="nb-link text-body-sm whitespace-nowrap min-h-touch">
          {action} →
        </button>
      )}
    </div>
  )
}

/* ── Card shell ─────────────────────────────────────────── */
export function Card({
  className = '',
  children,
  onClick,
}: {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`nb-card ${onClick ? 'cursor-pointer hover:shadow-medium transition-shadow duration-normal' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/* ── Input ──────────────────────────────────────────────── */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
>(function Input({ label, error, className = '', id, ...rest }, ref) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-body-sm font-semibold text-neutral-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full h-12 px-4 rounded-md border bg-white text-body text-neutral-900 placeholder:text-neutral-400 nb-focus transition-shadow duration-fast ${
          error ? 'border-error-500' : 'border-neutral-300'
        } ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-caption text-error-500">{error}</p>}
    </div>
  )
})

/* ── Empty state ────────────────────────────────────────── */
export function EmptyState({
  icon = '🗺️',
  title,
  body,
  action,
  onAction,
}: {
  icon?: string
  title: string
  body: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="nb-card flex flex-col items-center text-center py-14 px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
      <p className="text-body-sm text-neutral-500 mt-2 max-w-sm">{body}</p>
      {action && (
        <Button className="mt-5" size="md" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  )
}

/* ── Skeleton ───────────────────────────────────────────── */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`nb-skeleton ${className}`} />
}

export function ProductCardSkeleton() {
  return (
    <div className="nb-card p-0 overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

/* ── Tabs ───────────────────────────────────────────────── */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { id: T; label: string; count?: number }[]
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={`nb-scroll-x flex gap-2 pb-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap transition-colors duration-fast min-h-touch ${
            active === t.id
              ? 'bg-primary-500 text-white shadow-soft'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className={`ml-1.5 ${active === t.id ? 'text-white/80' : 'text-neutral-400'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Metric card (dashboards) ───────────────────────────── */
export function StatCard({
  label,
  value,
  change,
  hint,
  accent = 'text-neutral-900',
}: {
  label: string
  value: string | number
  change?: string
  hint?: string
  accent?: string
}) {
  return (
    <div className="nb-card p-5">
      <p className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className={`font-data text-[32px] font-extrabold mt-2 leading-none ${accent}`}>{value}</p>
      {change && <p className="text-[13px] font-semibold text-success-600 mt-2">↑ {change}</p>}
      {hint && <p className="text-caption text-neutral-400 mt-1">{hint}</p>}
    </div>
  )
}

/* ── Alert ──────────────────────────────────────────────── */
export function Alert({
  kind = 'info',
  title,
  children,
}: {
  kind?: 'success' | 'warning' | 'error' | 'info'
  title: string
  children?: React.ReactNode
}) {
  const map = {
    success: { bg: 'bg-success-50 border-success-200', icon: CheckCircle2, color: 'text-success-600' },
    warning: { bg: 'bg-warning-50 border-warning-200', icon: AlertTriangle, color: 'text-warning-700' },
    error: { bg: 'bg-error-50 border-error-200', icon: XCircle, color: 'text-error-500' },
    info: { bg: 'bg-sky-50 border-sky-200', icon: Info, color: 'text-sky-600' },
  }[kind]
  const Icon = map.icon
  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${map.bg}`}>
      <Icon size={20} className={map.color} />
      <div>
        <p className={`text-body-sm font-semibold ${map.color}`}>{title}</p>
        {children && <div className="text-body-sm text-neutral-600 mt-1">{children}</div>}
      </div>
    </div>
  )
}

/* ── Toasts ─────────────────────────────────────────────── */
export function ToastHost() {
  const { toasts, dismissToast } = useApp()
  const kindStyle: Record<string, string> = {
    success: 'border-success-200',
    info: 'border-sky-200',
    warning: 'border-warning-200',
    error: 'border-error-200',
  }
  const kindIcon: Record<string, React.ReactNode> = {
    success: <CheckCircle2 size={18} className="text-success-500" />,
    info: <Info size={18} className="text-sky-500" />,
    warning: <AlertTriangle size={18} className="text-warning-500" />,
    error: <XCircle size={18} className="text-error-500" />,
  }
  return (
    <div className="fixed z-[80] bottom-24 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-slideup flex items-start gap-3 bg-white border rounded-xl shadow-medium p-4 ${kindStyle[t.kind]}`}
        >
          {kindIcon[t.kind]}
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-neutral-900">{t.title}</p>
            {t.body && <p className="text-caption text-neutral-500 mt-0.5">{t.body}</p>}
          </div>
          <button
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
            className="text-neutral-400 hover:text-neutral-600 min-w-touch min-h-touch -m-2 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Price display ──────────────────────────────────────── */
export function Price({
  value,
  mrp,
  size = 'card',
  className = '',
}: {
  value: number
  mrp?: number
  size?: 'card' | 'page' | 'sm'
  className?: string
}) {
  const sizeCls = size === 'page' ? 'text-[28px]' : size === 'card' ? 'text-xl' : 'text-base'
  const showSave = mrp && mrp > value
  return (
    <div className={`flex items-baseline gap-2 flex-wrap ${className}`}>
      <span className={`font-bold font-data text-neutral-900 ${sizeCls}`}>
        ₹{value.toLocaleString('en-IN')}
      </span>
      {showSave && (
        <>
          <span className="text-body-sm font-medium text-neutral-400 line-through">
            ₹{mrp!.toLocaleString('en-IN')}
          </span>
          <span className="text-[13px] font-semibold text-success-600">
            Save ₹{(mrp! - value).toLocaleString('en-IN')}
          </span>
        </>
      )}
    </div>
  )
}
