import { ArrowUpRight, Bike, CircleCheck, TrendingUp, Wallet } from 'lucide-react'
import { useRider } from '../../rider/RiderContext'
import { HubEmpty, HubError, HubLoading, rupees } from '../../seller/components'

export default function RiderEarnings() {
  const { earnings, performance, loading, error, refresh } = useRider()
  if (loading && !earnings) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  return (
    <div className="hub-page">
      <div className="hub-page-header">
        <div>
          <p className="hub-overline dark">RIDER HUB / YOUR MONEY</p>
          <h1>Your earnings</h1>
          <p>Every completed delivery, clearly accounted for.</p>
        </div>
      </div>
      <div className="rider-earnings-hero">
        <div>
          <span className="rider-earnings-icon">
            <Wallet size={26} />
          </span>
          <p>TOTAL EARNINGS</p>
          <strong>{rupees(earnings?.balance || 0)}</strong>
          <span>From deliveries completed with NearBuy</span>
        </div>
        <TrendingUp size={103} strokeWidth={1.15} className="rider-earnings-art" />
      </div>
      <div className="hub-stats hub-stats-three">
        <div className="hub-stat">
          <span className="hub-stat-icon blue">
            <CircleCheck size={20} />
          </span>
          <p>Completed trips</p>
          <strong>{earnings?.completed || 0}</strong>
          <small>Across your time with us</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon green">
            <Bike size={20} />
          </span>
          <p>Your zone</p>
          <strong className="hub-stat-text">{performance?.zone || 'Dwarka'}</strong>
          <small>Local deliveries, less travel</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon violet">
            <ArrowUpRight size={20} />
          </span>
          <p>Rider rating</p>
          <strong>
            {Number(performance?.rating || 5).toFixed(1)} <span className="rider-rating-star">★</span>
          </strong>
          <small>Keep up the good work</small>
        </div>
      </div>
      <div className="hub-panel rider-history">
        <div className="hub-panel-heading">
          <div>
            <p className="hub-panel-eyebrow">THE DETAILS</p>
            <h2>Recent completed deliveries</h2>
          </div>
        </div>
        {earnings?.recent?.length ? (
          <div className="rider-history-list">
            {earnings.recent.map((trip, i) => (
              <div key={`${trip.order}-${i}`}>
                <span className="rider-history-icon">
                  <CircleCheck size={19} />
                </span>
                <span>
                  <strong>{trip.order}</strong>
                  <small>Delivery complete</small>
                </span>
                <strong>+{rupees(trip.fee)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <HubEmpty
            title="Your first delivery is waiting"
            body="When you complete a delivery, your earnings will appear here."
          />
        )}
      </div>
    </div>
  )
}
