'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLogin, useSession } from '@nearbuy/api'
import { useBootstrapSession, Button, Card, Input, Label, FieldError, s } from '@nearbuy/ui'

export default function SellerLogin() {
  const router = useRouter()
  const login = useLogin()
  const s0 = useSession()
  const [err, setErr] = React.useState<string | undefined>()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(undefined)
    try {
      const r = await login.mutateAsync({ email: String(fd.get('email')), password: String(fd.get('password')) })
      s0.setToken(r.accessToken)
      s0.setUser(r.user)
      s0.setChecked(true)
      router.push('/seller')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    }
  }

  return (
    <div className="nb-container flex justify-center py-12">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{s('seller.signIn', 'Seller sign in')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{s('seller.signInHint', 'Manage orders, reservations and inventory for your store.')}</p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          <div><Label htmlFor="email">{s('auth.email', 'Email')}</Label><Input id="email" name="email" type="email" required /></div>
          <div><Label htmlFor="password">{s('auth.password', 'Password')}</Label><Input id="password" name="password" type="password" required /></div>
          {err && <p role="alert" className="rounded-card bg-error-50 p-2 text-sm font-semibold text-error-500">{err}</p>}
          <Button type="submit" size="lg" loading={login.isPending}>{s('auth.signIn', 'Sign in')}</Button>
        </form>
      </Card>
    </div>
  )
}
