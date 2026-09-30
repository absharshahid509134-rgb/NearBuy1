import { useState, type FormEvent } from 'react'
import { ArrowRight, Bike, Check, Clock3, MapPin, Navigation, Package, Store } from 'lucide-react'
import { useRider, type JobStatus, type RiderJob } from './RiderContext'
import { rupees } from '../seller/components'

const steps: Record<string, { status: JobStatus; label: string; needsCode?: boolean }> = {
  ASSIGNED: { status: 'AT_STORE', label: 'I’m at the store' },
  AT_STORE: { status: 'PICKED_UP', label: 'Confirm pickup', needsCode: true },
  PICKED_UP: { status: 'AT_CUSTOMER', label: 'I’m at the customer' },
  AT_CUSTOMER: { status: 'DELIVERED', label: 'Complete delivery', needsCode: true },
}
const statusText: Record<string, string> = {
  PENDING: 'Available now',
  ASSIGNED: 'Head to pickup',
  AT_STORE: 'At the store',
  PICKED_UP: 'On the way',
  AT_CUSTOMER: 'At drop-off',
  DELIVERED: 'Delivered',
}
const codes: Record<string, { pickup: string; drop: string }> = {
  'demo-job-1': { pickup: '4417', drop: '8821' },
  'demo-job-2': { pickup: '1034', drop: '6820' },
}

export function JobCard({ job, featured = false }: { job: RiderJob; featured?: boolean }) {
  const { accept, advance, performance } = useRider()
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = steps[job.status]
  const demoCode = __NEARBUY_PREVIEW__
    ? job.status === 'AT_STORE'
      ? codes[job.id]?.pickup
      : job.status === 'AT_CUSTOMER'
        ? codes[job.id]?.drop
        : undefined
    : undefined

  async function act(event?: FormEvent) {
    event?.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (job.status === 'PENDING') await accept(job.id)
      else if (next) await advance(job.id, next.status, next.needsCode ? code.trim() : undefined)
      setCode('')
      setCodeOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this delivery.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className={`rider-job ${featured ? 'featured' : ''}`}>
      <div className="rider-job-top">
        <div>
          <span className="rider-job-id">{job.number}</span>
          <span className={`rider-job-status ${job.status === 'PENDING' ? 'new' : ''}`}>
            <span />
            {statusText[job.status] || job.status.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>
        <strong>
          {rupees(job.fee)} <small>this trip</small>
        </strong>
      </div>
      <div className="rider-job-route">
        <div className="rider-job-path">
          <span className="rider-route-dot pickup" />
          <span className="rider-route-line" />
          <span className="rider-route-dot drop" />
        </div>
        <div className="rider-job-stops">
          <div>
            <small>PICK UP FROM</small>
            <strong>{job.pickup?.name || 'Local store'}</strong>
            <span>
              {job.pickup?.area || 'Nearby'}
              {job.status !== 'PENDING' && job.pickup?.address ? ` · ${job.pickup.address}` : ''}
            </span>
          </div>
          <div>
            <small>DROP OFF</small>
            <strong>{job.drop || 'Customer in your zone'}</strong>
            <span>Address shared with assigned rider</span>
          </div>
        </div>
      </div>
      <div className="rider-job-meta">
        <span>
          <Navigation size={15} /> {Number(job.distanceKm).toFixed(1)} km trip
        </span>
        <span>
          <Package size={15} /> {job.packageCount} {job.packageCount === 1 ? 'item' : 'items'}
        </span>
        {job.items.length > 0 && (
          <span className="rider-job-item-name">{job.items.map((item) => item.name).join(', ')}</span>
        )}
      </div>
      {error && (
        <div className="hub-inline-error" role="alert">
          {error}
        </div>
      )}
      {codeOpen && next?.needsCode ? (
        <form className="rider-code-form" onSubmit={(e) => void act(e)}>
          <label htmlFor={`code-${job.id}`}>
            {next.status === 'PICKED_UP' ? 'Store pickup code' : 'Customer handoff code'}
          </label>
          <div>
            <input
              id={`code-${job.id}`}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
              maxLength={12}
              required
              inputMode="numeric"
              placeholder="Enter code"
            />
            <button type="submit" disabled={busy || !code.trim()}>
              {busy ? 'Checking…' : 'Verify & continue'} <ArrowRight size={15} />
            </button>
          </div>
          <p>
            Ask {next.status === 'PICKED_UP' ? 'the store' : 'the customer'} for the code at handoff.
            {demoCode && (
              <>
                {' '}
                Preview code: <strong>{demoCode}</strong>.
              </>
            )}
          </p>
          <button
            className="rider-code-cancel"
            type="button"
            onClick={() => {
              setCodeOpen(false)
              setCode('')
              setError('')
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="rider-job-actions">
          <div>
            {job.status === 'PENDING' ? (
              <>
                <Clock3 size={17} /> Ready for a rider
              </>
            ) : (
              <>
                <Check size={17} />{' '}
                {job.status === 'PICKED_UP' || job.status === 'AT_CUSTOMER'
                  ? 'Package collected'
                  : 'Assignment accepted'}
              </>
            )}
          </div>
          <button
            disabled={busy || (job.status === 'PENDING' && !performance?.available)}
            onClick={() => (next?.needsCode ? setCodeOpen(true) : void act())}
          >
            {busy
              ? 'Updating…'
              : job.status === 'PENDING'
                ? 'Accept delivery'
                : next?.label || 'View details'}{' '}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </article>
  )
}
