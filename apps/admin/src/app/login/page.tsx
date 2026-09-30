'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLogin, useSession } from '@nearbuy/api'
import { Button, Card, Input, Label, s } from '@nearbuy/ui'

export default function AdminLogin() {
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
      router.push('/admin')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    }
  }

  return (
    <div className="nb-container flex justify-center py-12">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{s('admin.signIn', 'Admin sign in')}</h1>
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
