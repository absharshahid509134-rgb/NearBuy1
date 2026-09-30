import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bike,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Store,
} from 'lucide-react'
import { Brand } from '../components/Brand'
import { WrongPortalError, useAuth } from '../auth/AuthContext'
import { homeForUser, isPortal, PORTALS, safeReturnTo, type Portal } from '../auth/portals'

const visiblePortals = ['customer', 'seller', 'rider'] as const
const portalArt = {
  customer: {
    icon: ShoppingBag,
    image: '/images/local-market.jpg',
    caption: 'A better way to shop close to home.',
    line: 'Find your next favourite thing around the corner.',
  },
  seller: {
    icon: Store,
    image: '/images/store-sports.jpg',
    caption: 'Your store. A whole new reach.',
    line: 'Less admin, more of the people you serve.',
  },
  rider: {
    icon: Bike,
    image: '/images/rider-neighbourhood.jpg',
    caption: 'Good journeys start nearby.',
    line: 'Clear deliveries and earnings you can follow.',
  },
  admin: {
    icon: ShieldCheck,
    image: '/images/hero.jpg',
    caption: 'One connected operation.',
    line: 'A private space for the NearBuy team.',
  },
} as const
const demoAccounts = {
  customer: { email: 'customer@nearbuy.dev', password: 'Customer@123' },
  seller: { email: 'seller.sports@nearbuy.dev', password: 'Seller@123' },
  rider: { email: 'delivery@nearbuy.dev', password: 'Delivery@123' },
  admin: { email: 'admin@nearbuy.dev', password: 'Admin@123' },
}

export default function AuthPage({ mode }: { mode: 'login' | 'join' }) {
  const { portal: portalParam } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, checking, connectionError, login, register, requestOtp, verifyOtp, logout } = useAuth()
  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [previewCode, setPreviewCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wrongPortal, setWrongPortal] = useState<Portal | null>(null)

  if (!isPortal(portalParam) || (mode === 'join' && portalParam === 'admin'))
    return <Navigate to="/" replace />
  const portal = portalParam
  const settings = PORTALS[portal]
  const art = portalArt[portal]
  const ArtIcon = art.icon
  const destination =
    mode === 'join' && portal === 'seller' ? '/seller/onboarding' : safeReturnTo(params.get('next'), portal)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setWrongPortal(null)
    setBusy(true)
    try {
      if (mode === 'join') {
        if (name.trim().length < 2) throw new Error('Please enter your full name.')
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
        await register(portal as 'customer' | 'seller' | 'rider', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        })
      } else if (method === 'phone' && portal === 'customer') {
        if (!codeSent) {
          const result = await requestOtp(phone.trim())
          setCodeSent(true)
          if (__NEARBUY_PREVIEW__ && result.devCode) setPreviewCode(result.devCode)
          return
        }
        await verifyOtp(code.trim(), phone.trim())
      } else {
        await login(portal, email.trim().toLowerCase(), password)
      }
      navigate(destination, { replace: true })
    } catch (cause) {
      if (cause instanceof WrongPortalError) setWrongPortal(cause.actual)
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function switchAccount() {
    setBusy(true)
    setError('')
    try {
      await logout()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`auth-page auth-${portal}`}>
      <header className="auth-header">
        <div className="auth-wrap">
          <Brand />
          <Link className="auth-back" to="/">
            <ArrowLeft size={17} /> Back to NearBuy
          </Link>
        </div>
      </header>
      <main className="auth-main auth-wrap">
        <aside className="auth-story">
          <img src={art.image} alt="" aria-hidden="true" />
          <div className="auth-story-shade" />
          <div className="auth-story-content">
            <span className="auth-story-tag">
              <ArtIcon size={17} /> {settings.name.toUpperCase()}
            </span>
            <div>
              <p className="auth-story-label">MADE FOR YOUR JOURNEY</p>
              <h2>{art.caption}</h2>
              <p>{art.line}</p>
            </div>
            <div className="auth-story-bottom">
              <span>
                <MapPin size={16} /> What you need, already nearby.
              </span>
              <span>
                nearbuy<span>.</span>
              </span>
            </div>
          </div>
        </aside>
        <section className="auth-form-panel" aria-labelledby="auth-heading">
          <div className="auth-form-inner">
            {portal !== 'admin' && (
              <div className="auth-portal-selector" role="navigation" aria-label="Choose your sign-in portal">
                {visiblePortals.map((p) => (
                  <Link
                    key={p}
                    className={p === portal ? 'active' : ''}
                    aria-current={p === portal ? 'page' : undefined}
                    to={`/${mode}/${p}`}
                  >
                    {p === 'customer' ? 'Customer' : p === 'seller' ? 'Seller' : 'Rider'}
                  </Link>
                ))}
              </div>
            )}
            {checking ? (
              <div className="auth-checking">
                <span className="auth-spinner" /> Checking your session…
              </div>
            ) : user ? (
              <div className="auth-signed-in">
                <span className="auth-signed-icon">
                  <CheckCircle2 size={29} />
                </span>
                <p className="auth-overline">YOU'RE ALREADY SIGNED IN</p>
                <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
                <p>You’re signed in to your NearBuy workspace. Your account stays in its own space.</p>
                <Link to={homeForUser(user)} className="auth-submit">
                  Continue to my workspace <ArrowRight size={19} />
                </Link>
                <button
                  className="auth-switch-account"
                  type="button"
                  disabled={busy}
                  onClick={() => void switchAccount()}
                >
                  Use a different account
                </button>
                {error && (
                  <div role="alert" className="auth-error">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="auth-overline">
                  {mode === 'join' ? 'LET’S GET YOU STARTED' : `WELCOME TO ${settings.name.toUpperCase()}`}
                </p>
                <h1 id="auth-heading">
                  {mode === 'join'
                    ? portal === 'customer'
                      ? 'Join the neighbourhood.'
                      : portal === 'seller'
                        ? 'Bring your store closer.'
                        : 'Let’s get moving.'
                    : portal === 'admin'
                      ? 'Operations sign in.'
                      : 'Good to have you back.'}
                </h1>
                <p className="auth-intro">
                  {mode === 'join'
                    ? portal === 'seller'
                      ? 'Create your account, then set up your store in a few simple steps.'
                      : portal === 'rider'
                        ? 'Create your rider account and start finding local deliveries.'
                        : 'Make it easy to shop the good things already near you.'
                    : settings.description}
                </p>

                {portal === 'customer' && mode === 'login' && (
                  <div className="auth-methods" role="tablist" aria-label="Sign-in method">
                    <button
                      role="tab"
                      aria-selected={method === 'email'}
                      className={method === 'email' ? 'selected' : ''}
                      type="button"
                      onClick={() => {
                        setMethod('email')
                        setError('')
                      }}
                    >
                      <Mail size={15} /> Email
                    </button>
                    <button
                      role="tab"
                      aria-selected={method === 'phone'}
                      className={method === 'phone' ? 'selected' : ''}
                      type="button"
                      onClick={() => {
                        setMethod('phone')
                        setError('')
                      }}
                    >
                      <Phone size={15} /> Phone code
                    </button>
                  </div>
                )}

                <form onSubmit={(e) => void submit(e)} className="auth-form">
                  {mode === 'join' && (
                    <label className="auth-field">
                      <span>Your name</span>
                      <input
                        autoFocus
                        type="text"
                        autoComplete="name"
                        placeholder="Your full name"
                        minLength={2}
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                  )}
                  {method === 'phone' && mode === 'login' && portal === 'customer' ? (
                    <>
                      <label className="auth-field">
                        <span>Mobile number</span>
                        <input
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="+91 98100 00001"
                          minLength={10}
                          required
                          disabled={codeSent}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </label>
                      {codeSent && (
                        <>
                          <label className="auth-field">
                            <span>Six-digit code</span>
                            <input
                              autoFocus
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]{6}"
                              maxLength={6}
                              required
                              placeholder="000000"
                              value={code}
                              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            />
                          </label>
                          {previewCode && (
                            <p className="auth-code-hint">
                              Preview code: <strong>{previewCode}</strong> · No SMS is sent in preview mode.
                            </p>
                          )}
                          <button
                            className="auth-text-button"
                            type="button"
                            onClick={() => {
                              setCodeSent(false)
                              setCode('')
                              setPreviewCode('')
                            }}
                          >
                            Use a different number
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="auth-field">
                        <span>{portal === 'seller' ? 'Business email' : 'Email address'}</span>
                        <input
                          autoFocus={mode === 'login'}
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </label>
                      <label className="auth-field">
                        <span>Password</span>
                        <span className="auth-password-wrap">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete={mode === 'join' ? 'new-password' : 'current-password'}
                            placeholder={mode === 'join' ? 'At least 8 characters' : 'Enter your password'}
                            required
                            minLength={mode === 'join' ? 8 : 1}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </span>
                      </label>
                    </>
                  )}
                  {connectionError && (
                    <div role="status" className="auth-error">
                      {connectionError}
                    </div>
                  )}
                  {error && (
                    <div role="alert" className="auth-error">
                      {error}{' '}
                      {wrongPortal && (
                        <Link to={`/login/${wrongPortal}`}>
                          Go to {PORTALS[wrongPortal].name} <ArrowUpRight size={14} />
                        </Link>
                      )}
                    </div>
                  )}
                  <button className="auth-submit" type="submit" disabled={busy}>
                    {busy ? (
                      <>
                        <span className="auth-spinner" /> Please wait…
                      </>
                    ) : (
                      <>
                        {mode === 'join'
                          ? 'Create my account'
                          : method === 'phone' && portal === 'customer'
                            ? codeSent
                              ? 'Verify & continue'
                              : 'Send me a code'
                            : `Sign in to ${settings.name}`}{' '}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
                {portal === 'admin' ? (
                  <p className="auth-alternate">Need access? Contact your administrator.</p>
                ) : (
                  <p className="auth-alternate">
                    {mode === 'join' ? 'Already have an account?' : 'New to NearBuy?'}{' '}
                    <Link to={`/${mode === 'join' ? 'login' : 'join'}/${portal}`}>
                      {mode === 'join' ? 'Sign in' : 'Create an account'} <ArrowUpRight size={14} />
                    </Link>
                  </p>
                )}
                {__NEARBUY_PREVIEW__ && mode === 'login' && (
                  <div className="auth-demo">
                    <div>
                      <span className="auth-demo-icon">
                        <LockKeyhole size={16} />
                      </span>
                      <div>
                        <strong>Explore the preview</strong>
                        <small>Use a sample {settings.name.toLowerCase()} account</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMethod('email')
                        setEmail(demoAccounts[portal].email)
                        setPassword(demoAccounts[portal].password)
                        setError('')
                      }}
                    >
                      Fill demo details <ArrowRight size={15} />
                    </button>
                  </div>
                )}
                <div className="auth-safety">
                  <ShieldCheck size={16} />
                  <span>Your account determines your access. Switching portals never changes your role.</span>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <footer className="auth-footer auth-wrap">
        <span>© 2026 NearBuy</span>
        <span>One community. Your own space.</span>
      </footer>
    </div>
  )
}
