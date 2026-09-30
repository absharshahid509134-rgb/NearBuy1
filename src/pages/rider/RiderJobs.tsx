import { useState } from 'react'
import { Bike, Navigation, RefreshCw } from 'lucide-react'
import { useRider } from '../../rider/RiderContext'
import { JobCard } from '../../rider/JobCard'
import { HubEmpty, HubError, HubLoading } from '../../seller/components'

export default function RiderJobs() {
  const { active, available, performance, loading, error, refresh } = useRider()
  const [tab, setTab] = useState<'available' | 'active'>('available')
  if (loading && !performance) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  const shown = tab === 'available' ? available : active
  return (
    <div className="hub-page">
      <div className="hub-page-header">
        <div>
          <p className="hub-overline dark">RIDER HUB / DELIVERIES</p>
          <h1>Deliveries</h1>
          <p>Find your next local job and keep every handoff moving.</p>
        </div>
        <button className="hub-secondary-button" onClick={() => void refresh()}>
          <RefreshCw size={16} /> Refresh jobs
        </button>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Delivery list">
        <button
          role="tab"
          aria-selected={tab === 'available'}
          className={tab === 'available' ? 'selected' : ''}
          onClick={() => setTab('available')}
        >
          <Bike size={17} /> Available <span>{available.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'active'}
          className={tab === 'active' ? 'selected' : ''}
          onClick={() => setTab('active')}
        >
          <Navigation size={17} /> My active jobs <span>{active.length}</span>
        </button>
      </div>
      {!performance?.available && tab === 'available' && (
        <div className="rider-offline-note">
          You’re offline. Go online from your overview or profile to accept a delivery.
        </div>
      )}
      {shown.length ? (
        <div className="rider-job-grid">
          {shown.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <HubEmpty
          title={tab === 'active' ? 'No deliveries in progress' : 'No jobs available right now'}
          body={
            tab === 'active'
              ? 'Accept a job from the Available tab to get started.'
              : 'Keep an eye on this page — new local deliveries will appear here.'
          }
        />
      )}
    </div>
  )
}
