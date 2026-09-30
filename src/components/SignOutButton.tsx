import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export function SignOutButton({ className = '' }: { className?: string }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await logout()
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => void signOut()} disabled={busy} className={className}>
        <LogOut size={17} /> {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && (
        <span className="text-[11px] text-red-500 mt-1" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
