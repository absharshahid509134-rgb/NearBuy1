'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLogin, useRegister, useVerifyOtp, useSession } from '@nearbuy/api'
import { loginSchema, registerSchema, otpSchema } from '@nearbuy/validation'
import { Button, Card, Input, Label, FieldError, s } from '@nearbuy/ui'

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="nb-container flex justify-center py-12">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-ink-secondary">{footer}</div>}
      </Card>
    </div>
  )
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  return <p role="alert" className="mt-3 rounded-card bg-error-50 p-2 text-sm font-semibold text-error-500">{msg}</p>
}

export function LoginForm() {
  const router = useRouter()
  const login = useLogin()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({ email: fd.get('email'), password: fd.get('password') })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] ?? 'form', i.message])))
      return
    }
    setErrors({})
    try {
      const r = await login.mutateAsync(parsed.data)
      router.push(r.user.role === 'CUSTOMER' ? '/' : r.user.role === 'SUPER_ADMIN' || r.user.role === 'ADMIN' ? '/admin' : '/seller')
    } catch { /* rendered below */ }
  }
  return (
    <AuthShell
      title={s('auth.signIn', 'Sign in')}
      subtitle={s('auth.signInSub', 'One account for shopping, selling and managing.')}
      footer={<Link href="/signup" className="font-bold text-primary-600">{s('auth.noAccount', 'Create an account')}</Link>}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="email">{s('auth.email', 'Email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} />
          <FieldError message={errors.email} />
        </div>
        <div>
          <Label htmlFor="password">{s('auth.password', 'Password')}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(errors.password)} />
          <FieldError message={errors.password} />
        </div>
        <Button type="submit" size="lg" loading={login.isPending}>{s('auth.signIn', 'Sign in')}</Button>
      </form>
      <FormError error={login.error} />
    </AuthShell>
  )
}

export function RegisterForm() {
  const router = useRouter()
  const reg = useRegister()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = { name: fd.get('name'), email: fd.get('email'), password: fd.get('password'), phone: fd.get('phone') || undefined, role: (fd.get('role') as 'CUSTOMER' | 'SELLER') ?? 'CUSTOMER' }
    const parsed = registerSchema.safeParse(input)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] ?? 'form', i.message])))
      return
    }
    setErrors({})
    try {
      const r = await reg.mutateAsync(parsed.data)
      router.push(`/otp?userId=${encodeURIComponent(r.user.id)}`)
    } catch { /* rendered below */ }
  }
  return (
    <AuthShell
      title={s('auth.signUp', 'Sign up')}
      subtitle={s('auth.signUpSub', 'NearBuy — What You Need, Already Nearby.')}
      footer={<Link href="/login" className="font-bold text-primary-600">{s('auth.haveAccount', 'I already have an account')}</Link>}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="name">{s('auth.name', 'Full name')}</Label>
          <Input id="name" name="name" autoComplete="name" required />
          <FieldError message={errors.name} />
        </div>
        <div>
          <Label htmlFor="email">{s('auth.email', 'Email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError message={errors.email} />
        </div>
        <div>
          <Label htmlFor="phone">{s('auth.phone', 'Phone (optional)')}</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+91…" />
          <FieldError message={errors.phone} />
        </div>
        <div>
          <Label htmlFor="password">{s('auth.password', 'Password')}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <FieldError message={errors.password} />
        </div>
        <div>
          <Label htmlFor="role">{s('auth.iAm', 'I want to')}</Label>
          <select id="role" name="role" className="h-11 w-full rounded-card border border-border bg-card px-3 text-sm">
            <option value="CUSTOMER">{s('auth.shop', 'Shop nearby')}</option>
            <option value="SELLER">{s('home.becomeSeller', 'Become a Seller')}</option>
          </select>
        </div>
        <Button type="submit" size="lg" loading={reg.isPending}>{s('auth.createAccount', 'Create account')}</Button>
      </form>
      <FormError error={reg.error} />
    </AuthShell>
  )
}

export function OtpForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const verify = useVerifyOtp()
  const { setUser, setChecked, setToken } = useSession()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const userId = sp.get('userId') ?? ''
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = otpSchema.safeParse({ userId, code: fd.get('code') })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] ?? 'form', i.message])))
      return
    }
    try {
      const r = await verify.mutateAsync(parsed.data)
      setToken(r.accessToken)
      setUser(r.user)
      setChecked(true)
      router.push('/')
    } catch { /* rendered below */ }
  }
  return (
    <AuthShell title={s('auth.otpTitle', 'Verify your phone')} subtitle={s('auth.otpSub', 'Enter the 6-digit code we sent you.')}>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="code">{s('auth.otpCode', 'OTP code')}</Label>
          <Input id="code" name="code" inputMode="numeric" maxLength={6} required className="text-center text-xl tracking-[0.5em]" />
          <FieldError message={errors.code} />
        </div>
        <Button type="submit" size="lg" loading={verify.isPending}>{s('auth.verify', 'Verify')}</Button>
      </form>
      <FormError error={verify.error} />
    </AuthShell>
  )
}

