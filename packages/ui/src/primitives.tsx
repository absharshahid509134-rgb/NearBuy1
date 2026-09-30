/**
 * NearBuy design-system primitives (§47): Button, Input, Label, Select, Badge,
 * Card, Skeleton, Spinner, EmptyState, SectionHeader. Tokens live in ./tokens.
 */
import * as React from 'react'
import { cn } from './index'
import { s } from './strings'

type BtnVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'destructive'
type BtnSize = 'sm' | 'md' | 'lg'

const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-600',
  accent: 'bg-accent-400 text-ink hover:bg-accent-500 focus-visible:ring-accent-500',
  outline: 'border border-border bg-card text-ink hover:bg-canvas focus-visible:ring-primary-600',
  ghost: 'text-primary-600 hover:bg-primary-50 focus-visible:ring-primary-600',
  destructive: 'bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-card font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        btnVariants[variant], btnSizes[size], className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-card border border-border bg-card px-3 text-sm text-ink placeholder:text-ink-muted',
        'focus:outline-none focus:ring-2 focus:ring-primary-600/40 focus:border-primary-600',
        className,
      )}
      {...rest}
    />
  )
}

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-semibold text-ink-secondary', className)} {...rest} />
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('h-11 rounded-card border border-border bg-card px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-600/40', className)}
      {...rest}
    >
      {children}
    </select>
  )
}

export type BadgeTone = 'success' | 'warning' | 'info' | 'error' | 'neutral' | 'accent' | 'reserve'
const badgeTones: Record<BadgeTone, string> = {
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  info: 'bg-info-50 text-info-700 border-info-200',
  error: 'bg-error-50 text-error-600 border-error-200',
  neutral: 'bg-canvas text-ink-secondary border-border',
  accent: 'bg-accent-50 text-accent-700 border-accent-200',
  reserve: 'bg-reservebg text-reserve border-reserveborder',
}
export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-card border border-border bg-card shadow-card', className)}>{children}</div>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-card bg-neutral-100', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </Card>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
      {action}
    </div>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs font-medium text-error-500">{message}</p>
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
      <Spinner /> <span className="text-sm">{label ?? s('common.loading', 'Loading…')}</span>
    </div>
  )
}

export function ErrorBlock({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-error-500">{message ?? s('common.error', 'Something went wrong.')}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          {s('common.tryAgain', 'Try again')}
        </Button>
      )}
    </Card>
  )
}
