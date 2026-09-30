import { useState } from 'react'
import { BadgeCheck, Bike, CircleHelp, HeartHandshake, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { SignOutButton } from '../../components/SignOutButton'
import { useRider } from '../../rider/RiderContext'
import { HubError, HubLoading } from '../../seller/components'

export default function RiderProfile() {
  const { user } = useAuth()
  const { performance, earnings, loading, error, refresh, setAvailable } = useRider()
  const [busy, setBusy] = useState(false)
  const [toggleError, setToggleError] = useState('')
  if (loading && !performance) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  async function toggle() {
    setBusy(true)
    setToggleError('')
    try {
      await setAvailable(!performance?.available)
    } catch (cause) {
      setToggleError(cause instanceof Error ? cause.message : 'Could not change your status.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="hub-page">
      <div className="hub-page-header">
        <div>
          <p className="hub-overline dark">RIDER HUB / ACCOUNT</p>
          <h1>My rider profile</h1>
          <p>Your own space to stay ready for the road ahead.</p>
        </div>
      </div>
      <div className="hub-columns rider-profile-columns">
        <div className="hub-panel rider-profile-card">
          <div className="rider-profile-avatar">
            <UserRound size={31} />
          </div>
          <p className="hub-panel-eyebrow">YOUR RIDER ACCOUNT</p>
          <h2>{user?.name}</h2>
          <span className="rider-profile-verified">
            <BadgeCheck size={16} /> NearBuy delivery partner
          </span>
          <div className="rider-profile-detail">
            <span>
              <MapPin size={17} /> Delivery zone
            </span>
            <strong>{performance?.zone || 'Dwarka'}</strong>
          </div>
          <div className="rider-profile-detail">
            <span>
              <Bike size={17} /> Vehicle
            </span>
            <strong>{performance?.vehicle || 'Bike'}</strong>
          </div>
          <div className="rider-profile-detail">
            <span>
              <ShieldCheck size={17} /> Account access
            </span>
            <strong>Rider Hub only</strong>
          </div>
          <div className="rider-profile-logout">
            <SignOutButton className="hub-secondary-button" />
          </div>
        </div>
        <div className="hub-aside-stack">
          <div className="hub-panel rider-availability-card">
            <span className="hub-stat-icon green">
              <Bike size={22} />
            </span>
            <h2>Your availability</h2>
            <p>
              Choose when you’re ready for new deliveries. Going offline won’t affect a job you’ve already
              accepted.
            </p>
            <div className="rider-availability-card-toggle">
              <span>
                <strong>{performance?.available ? 'Available for jobs' : 'On a break'}</strong>
                <small>{performance?.available ? 'Rider is online' : 'Rider is offline'}</small>
              </span>
              <button
                role="switch"
                aria-checked={!!performance?.available}
                aria-label="Available for deliveries"
                disabled={busy}
                onClick={() => void toggle()}
                className={`rider-switch ${performance?.available ? 'on' : ''}`}
              >
                <span />
              </button>
            </div>
            {toggleError && (
              <div className="hub-inline-error" role="alert">
                {toggleError}
              </div>
            )}
          </div>
          <div className="hub-panel rider-support">
            <HeartHandshake size={22} />
            <h2>We’re in this together.</h2>
            <p>
              Look after yourself on every trip. Always stop safely before checking your phone or confirming a
              handoff.
            </p>
            <div>
              <CircleHelp size={16} /> Need help on a delivery? Contact NearBuy support through your
              operations team.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
