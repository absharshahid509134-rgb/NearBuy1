import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  ChevronRight,
  CircleCheck,
  Compass,
  MapPin,
  Navigation,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useRider } from '../../rider/RiderContext'
import { JobCard } from '../../rider/JobCard'
import { HubEmpty, HubError, HubLoading, rupees } from '../../seller/components'
import { useState } from 'react'

export default function RiderDashboard() {
  const { user } = useAuth()
  const { available, active, earnings, performance, loading, error, refresh, setAvailable } = useRider()
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
      <div className="rider-welcome">
        <div className="rider-welcome-copy">
          <p className="hub-overline">
            <span /> RIDER HUB / TODAY
          </p>
          <h1>
            Your next stop
            <br />{' '}
            starts here, {user?.name.split(' ')[0] || 'rider'}.
          </h1>
          <p>Good routes, clear handoffs and a neighbourhood that’s counting on you.</p>
          <div className="rider-welcome-actions">
            <Link to="/rider/jobs">
              Find deliveries <ArrowRight size={17} />
            </Link>
            <span>
              <MapPin size={15} /> {performance?.zone || 'Dwarka'}, Delhi
            </span>
          </div>
        </div>
        <div className="rider-welcome-graphic" aria-hidden="true">
          <span className="rider-graphic-ring one" />
          <span className="rider-graphic-ring two" />
          <span className="rider-graphic-pin">
            <Bike size={37} />
          </span>
          <span className="rider-graphic-small">
            <MapPin size={21} />
          </span>
          <span className="rider-graphic-line" />
        </div>
      </div>
      <div className="rider-availability">
        <div>
          <span className={`rider-availability-icon ${performance?.available ? '' : 'offline'}`}>
            <Bike size={21} />
          </span>
          <div>
            <strong>You’re {performance?.available ? 'online and ready' : 'taking a break'}</strong>
            <p>
              {performance?.available
                ? 'Available jobs are waiting in your neighbourhood.'
                : 'Go online when you’re ready to accept new jobs.'}
            </p>
          </div>
        </div>
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
      <div className="hub-stats rider-stats">
        <div className="hub-stat">
          <span className="hub-stat-icon blue">
            <Compass size={20} />
          </span>
          <p>Available near you</p>
          <strong>{available.length}</strong>
          <small>Ready for pickup</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon amber">
            <Navigation size={20} />
          </span>
          <p>On your route</p>
          <strong>{active.length}</strong>
          <small>Active deliveries</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon green">
            <Wallet size={20} />
          </span>
          <p>Total earnings</p>
          <strong>{rupees(earnings?.balance || 0)}</strong>
          <small>Your account balance</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon violet">
            <CircleCheck size={20} />
          </span>
          <p>Deliveries made</p>
          <strong>{earnings?.completed || 0}</strong>
          <small>Every trip counts</small>
        </div>
      </div>
      <div className="hub-columns rider-columns">
        <div className="hub-panel rider-deliveries">
          <div className="hub-panel-heading">
            <div>
              <p className="hub-panel-eyebrow">KEEP MOVING</p>
              <h2>{active.length ? 'Your active delivery' : 'Available deliveries'}</h2>
            </div>
            <Link to="/rider/jobs">
              View all <ArrowUpRight size={16} />
            </Link>
          </div>
          {active.length ? (
            <JobCard job={active[0]} featured />
          ) : available.length ? (
            <JobCard job={available[0]} featured />
          ) : (
            <HubEmpty
              title="It’s quiet around you"
              body={
                performance?.available
                  ? 'No deliveries are available right now. Check back soon.'
                  : 'Go online when you’re ready to see and accept jobs.'
              }
            />
          )}
        </div>
        <div className="hub-aside-stack">
          <div className="rider-side-panel">
            <span className="rider-side-icon">
              <Navigation size={21} />
            </span>
            <p className="hub-panel-eyebrow">YOUR ZONE</p>
            <h3>Stay close. Go far.</h3>
            <p>Deliveries are matched to your area, so your next pickup is never too far away.</p>
            <div>
              <MapPin size={16} /> {performance?.zone || 'Dwarka'}, Delhi <ChevronRight size={16} />
            </div>
          </div>
          <div className="hub-panel rider-quick-panel">
            <div className="hub-panel-heading">
              <div>
                <p className="hub-panel-eyebrow">YOUR PROGRESS</p>
                <h2>Every trip adds up.</h2>
              </div>
            </div>
            <p>Your earnings and completed trips are always one tap away.</p>
            <Link to="/rider/earnings">
              See earnings <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
