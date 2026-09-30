import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  Clock3,
  Package,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useSeller } from '../../seller/SellerContext'
import { HubEmpty, HubError, HubLoading, rupees, StatusPill, when } from '../../seller/components'

export default function SellerDashboard() {
  const { user } = useAuth()
  const { profile, orders, reservations, inventory, stockRequests, loading, error, refresh } = useSeller()
  if (loading && !profile) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  const store = profile?.stores[0]
  const pending = orders.filter((o) =>
    ['PENDING', 'CONFIRMED', 'PREPARING', 'PACKED', 'READY_FOR_PICKUP'].includes(o.status),
  )
  const requests = reservations.filter((r) => r.status === 'REQUESTED')
  const available = inventory.filter((item) => item.availableQuantity > 0)
  const low = inventory.filter((item) => item.availableQuantity > 0 && item.availableQuantity <= 4)
  const sales = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, order) => sum + Number(order.total), 0)
  const firstName = user?.name.split(' ')[0] || 'there'
  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
        ? 'Good afternoon'
        : 'Good evening'

  return (
    <div className="hub-page">
      <div className="hub-welcome hub-welcome-seller">
        <div>
          <p className="hub-overline">
            <span /> SELLER HUB / OVERVIEW
          </p>
          <h1>
            {greeting}, {firstName}.
          </h1>
          <p>Here’s what’s happening at {store?.name ?? 'your store'} today.</p>
          <div className="hub-welcome-links">
            <Link to="/seller/orders">
              Manage orders <ArrowRight size={16} />
            </Link>
            <Link to="/seller/inventory">
              View inventory <ChevronRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hub-welcome-mark" aria-hidden="true">
          <Store size={90} strokeWidth={1.1} />
          <span className="hub-welcome-orbit" />
        </div>
      </div>

      <div className="hub-stats">
        <div className="hub-stat">
          <span className="hub-stat-icon blue">
            <Package size={20} />
          </span>
          <p>Active orders</p>
          <strong>{pending.length}</strong>
          <small>To prepare or hand over</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon amber">
            <Clock3 size={20} />
          </span>
          <p>New reservations</p>
          <strong>{requests.length}</strong>
          <small>Waiting for your reply</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon violet">
            <Boxes size={20} />
          </span>
          <p>Products in stock</p>
          <strong>{available.length}</strong>
          <small>Ready for neighbours to find</small>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-icon green">
            <TrendingUp size={20} />
          </span>
          <p>Completed sales</p>
          <strong>{rupees(sales)}</strong>
          <small>From your current order history</small>
        </div>
      </div>

      <div className="hub-columns">
        <div className="hub-panel">
          <div className="hub-panel-heading">
            <div>
              <p className="hub-panel-eyebrow">YOUR ACTIVITY</p>
              <h2>Recent orders</h2>
            </div>
            <Link to="/seller/orders">
              View all <ArrowUpRight size={16} />
            </Link>
          </div>
          {orders.length ? (
            <div className="hub-order-list">
              {orders.slice(0, 4).map((order) => (
                <div className="hub-order-row" key={order.id}>
                  <span className="hub-order-avatar">
                    <ShoppingBag size={19} />
                  </span>
                  <div className="hub-order-info">
                    <strong>{order.number}</strong>
                    <small>
                      {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ') || 'Store order'} ·{' '}
                      {when(order.createdAt)}
                    </small>
                  </div>
                  <div className="hub-order-side">
                    <strong>{rupees(order.total)}</strong>
                    <StatusPill status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <HubEmpty
              title="Your first order is around the corner"
              body="New orders will appear here as your neighbours find your store."
            />
          )}
        </div>
        <div className="hub-aside-stack">
          <div className="hub-panel hub-next">
            <div className="hub-panel-heading">
              <div>
                <p className="hub-panel-eyebrow">A GOOD PLACE TO START</p>
                <h2>Needs your attention</h2>
              </div>
              <Sparkles size={20} className="text-[#8b64c4]" />
            </div>
            <div className="hub-task-list">
              {stockRequests.length > 0 && <Link to="/seller/inventory"><span className="hub-task-icon blue"><Boxes size={18} /></span><span><strong>{stockRequests.length} shelf check{stockRequests.length !== 1 ? 's' : ''} to answer</strong><small>Let neighbours know what is on hand</small></span><ChevronRight size={17} /></Link>}
              <Link to="/seller/orders">
                <span className="hub-task-icon amber">
                  <Clock3 size={18} />
                </span>
                <span>
                  <strong>
                    {requests.length} reservation{requests.length !== 1 ? 's' : ''} to confirm
                  </strong>
                  <small>Keep pickup promises on track</small>
                </span>
                <ChevronRight size={17} />
              </Link>
              <Link to="/seller/orders">
                <span className="hub-task-icon blue">
                  <Package size={18} />
                </span>
                <span>
                  <strong>
                    {pending.length} order{pending.length !== 1 ? 's' : ''} in progress
                  </strong>
                  <small>Get them packed and ready</small>
                </span>
                <ChevronRight size={17} />
              </Link>
              <Link to="/seller/inventory">
                <span className="hub-task-icon red">
                  <Boxes size={18} />
                </span>
                <span>
                  <strong>
                    {low.length} low-stock item{low.length !== 1 ? 's' : ''}
                  </strong>
                  <small>Update before they sell out</small>
                </span>
                <ChevronRight size={17} />
              </Link>
            </div>
          </div>
          <div className="hub-store-panel">
            <div className="hub-store-icon">
              <Store size={23} />
            </div>
            <p>YOUR STORE</p>
            <h3>{store?.name || 'Your neighbourhood store'}</h3>
            <span>{store?.area || 'Your area'}</span>
            <div className="hub-store-footer">
              <span>
                <Check size={14} /> {store?.verified ? 'Verified store' : 'Verification in progress'}
              </span>
              <span>{store?.open ? 'Open' : 'Closed'}</span>
            </div>
            <Link to="/seller/account" className="hub-store-manage">Manage store <ArrowRight size={15} /></Link>
          </div>
        </div>
      </div>
    </div>
  )
}
