import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, ChartNoAxesCombined, Package, Store, TrendingUp } from 'lucide-react'
import { useSeller } from '../../seller/SellerContext'
import { HubError, HubLoading, rupees } from '../../seller/components'

export default function SellerGrowth() {
  const { profile, orders, reservations, inventory, loading, error, refresh } = useSeller()
  if (loading && !profile) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  const completed = orders.filter((o) => o.status === 'COMPLETED')
  const sales = completed.reduce((sum, order) => sum + Number(order.total), 0)
  const inStock = inventory.filter((item) => item.availableQuantity > 0)
  const coverage = inventory.length ? Math.round((inStock.length / inventory.length) * 100) : 0
  const low = inventory.filter((item) => item.availableQuantity > 0 && item.availableQuantity <= 4)
  return (
    <div className="hub-page">
      <div className="hub-page-header">
        <div>
          <p className="hub-overline dark">SELLER HUB / INSIGHTS</p>
          <h1>Grow your local reach</h1>
          <p>A simple look at how your store is doing, based on your orders and shelves.</p>
        </div>
      </div>
      <div className="hub-welcome hub-welcome-growth">
        <div>
          <p className="hub-overline">
            <span /> YOUR STORE, GOING PLACES
          </p>
          <h2>
            Small improvements.
            <br />A bigger neighbourhood.
          </h2>
          <p>
            Keep your stock fresh and your pickup promises on time. The little things make people come back.
          </p>
        </div>
        <ChartNoAxesCombined size={100} strokeWidth={1.2} className="hub-growth-art" />
      </div>
      <div className="hub-stats hub-stats-three">
        <div className="hub-stat">
          <span className="hub-stat-icon blue">
            <Package size={20} />
          </span>
          <p>Total orders</p>
          <strong>{orders.length}</strong>
          <small>All recorded orders</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon green">
            <TrendingUp size={20} />
          </span>
          <p>Completed sales</p>
          <strong>{rupees(sales)}</strong>
          <small>Across {completed.length} completed orders</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon violet">
            <Store size={20} />
          </span>
          <p>Reservations</p>
          <strong>{reservations.length}</strong>
          <small>Pickup requests received</small>
        </div>
      </div>
      <div className="hub-columns">
        <div className="hub-panel hub-health">
          <div className="hub-panel-heading">
            <div>
              <p className="hub-panel-eyebrow">STORE READINESS</p>
              <h2>Make your shelves easy to find</h2>
            </div>
          </div>
          <p className="hub-health-intro">
            Customers can only discover what you’ve marked in stock. Keeping quantities accurate is the best
            way to earn their trust.
          </p>
          <div className="hub-health-bar">
            <div>
              <strong>{coverage}%</strong>
              <span>of listed products available</span>
            </div>
            <div className="hub-progress">
              <span style={{ width: `${coverage}%` }} />
            </div>
          </div>
          <div className="hub-health-detail">
            <span>
              <BadgeCheck size={17} /> {inStock.length} ready to sell
            </span>
            <span>{low.length} need a top-up</span>
          </div>
          <Link className="hub-health-link" to="/seller/inventory">
            Review inventory <ArrowRight size={16} />
          </Link>
        </div>
        <div className="hub-panel hub-tip-panel">
          <p className="hub-panel-eyebrow">YOUR NEXT MOVES</p>
          <h2>Good habits grow good stores.</h2>
          <div className="hub-tip">
            <span>01</span>
            <p>
              <strong>Keep stock current</strong>
              <small>Update quantities as soon as something changes in-store.</small>
            </p>
          </div>
          <div className="hub-tip">
            <span>02</span>
            <p>
              <strong>Reply to reservations</strong>
              <small>Customers plan their visit around your confirmation.</small>
            </p>
          </div>
          <div className="hub-tip">
            <span>03</span>
            <p>
              <strong>Pack with care</strong>
              <small>Give every order the kind of service your shop is known for.</small>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
