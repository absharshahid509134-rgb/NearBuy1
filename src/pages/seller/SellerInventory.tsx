import { useState } from 'react'
import { Boxes, CheckCircle2, CircleAlert, HelpCircle, RefreshCw, Search, SlidersHorizontal, XCircle } from 'lucide-react'
import { useSeller, type SellerInventoryItem } from '../../seller/SellerContext'
import { HubEmpty, HubError, HubLoading, rupees, StatusPill, when } from '../../seller/components'

export default function SellerInventory() {
  const { inventory, stockRequests, loading, error, refresh, updateStock, respondToStockCheck } = useSeller()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [working, setWorking] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const items = inventory.filter(
    (item) =>
      `${item.name} ${item.brand ?? ''}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'low'
          ? item.availableQuantity > 0 && item.availableQuantity <= 4
          : item.availableQuantity === 0)),
  )
  const low = inventory.filter((item) => item.availableQuantity > 0 && item.availableQuantity <= 4).length
  const out = inventory.filter((item) => item.availableQuantity === 0).length
  async function respond(id: string, available: boolean) {
    setWorking(id)
    setActionError('')
    try { await respondToStockCheck(id, available) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not answer this request.') }
    finally { setWorking(null) }
  }
  async function save(item: SellerInventoryItem) {
    const quantity = Number(draft[item.id])
    if (!Number.isInteger(quantity) || quantity < item.reservedQuantity || quantity > 99999) {
      setActionError(`Enter a whole-number quantity of at least ${item.reservedQuantity} for ${item.name}.`)
      return
    }
    setWorking(item.id)
    setActionError('')
    try {
      await updateStock(item, quantity)
      setDraft((d) => {
        const next = { ...d }
        delete next[item.id]
        return next
      })
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not save this stock level.')
    } finally {
      setWorking(null)
    }
  }
  if (loading && !inventory.length) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  return (
    <div className="hub-page">
      <div className="hub-page-header">
        <div>
          <p className="hub-overline dark">SELLER HUB / YOUR SHELVES</p>
          <h1>Inventory</h1>
          <p>Keep what’s on your shelves in sync with what customers see.</p>
        </div>
        <button className="hub-secondary-button" onClick={() => void refresh()}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {actionError && <div className="hub-inline-error" role="alert">{actionError}</div>}
      <div className="hub-inventory-summary">
        <div>
          <span className="hub-stat-icon blue">
            <Boxes size={20} />
          </span>
          <strong>{inventory.length}</strong>
          <small>Products listed</small>
        </div>
        <div>
          <span className="hub-stat-icon amber">
            <CircleAlert size={20} />
          </span>
          <strong>{low}</strong>
          <small>Running low</small>
        </div>
        <div>
          <span className="hub-stat-icon red">
            <Boxes size={20} />
          </span>
          <strong>{out}</strong>
          <small>Out of stock</small>
        </div>
      </div>
      <section className="hub-panel hub-stock-checks" id="stock-requests" aria-labelledby="stock-requests-title">
        <div className="hub-panel-heading"><div><p className="hub-panel-eyebrow">FROM YOUR NEIGHBOURS</p><h2 id="stock-requests-title">Shelf checks {stockRequests.length ? `(${stockRequests.length})` : ''}</h2></div><HelpCircle size={20} className="text-primary-500" /></div>
        {stockRequests.length ? <div className="hub-stock-check-list">{stockRequests.map((check) => <div key={check.id} className="hub-stock-check"><div><strong>{check.product?.name ?? inventory.find((item) => item.productId === check.productId)?.name ?? 'Store product'}</strong><p>Customer asked for {check.qty} · {when(check.createdAt)}</p></div><div className="hub-stock-check-actions"><button type="button" disabled={working === check.id} onClick={() => void respond(check.id, true)}><CheckCircle2 size={16} /> In stock</button><button type="button" disabled={working === check.id} onClick={() => void respond(check.id, false)}><XCircle size={16} /> Not available</button></div></div>)}</div> : <p className="hub-stock-check-empty">No shelf checks waiting. When a neighbour asks you to confirm stock, you can answer right here.</p>}
      </section>
      <div className="hub-panel hub-inventory-panel">
        <div className="hub-inventory-tools">
          <label>
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your products…"
              aria-label="Search inventory"
            />
          </label>
          <div className="hub-filter-buttons" aria-label="Filter inventory">
            <SlidersHorizontal size={16} />
            {(['all', 'low', 'out'] as const).map((option) => (
              <button
                className={filter === option ? 'selected' : ''}
                key={option}
                onClick={() => setFilter(option)}
              >
                {option === 'all' ? 'All' : option === 'low' ? 'Low stock' : 'Sold out'}
              </button>
            ))}
          </div>
        </div>
        {items.length ? (
          <div className="hub-inventory-list">
            <div className="hub-inventory-labels">
              <span>PRODUCT</span>
              <span>PRICE</span>
              <span>AVAILABLE</span>
              <span>TOTAL STOCK</span>
              <span>STATUS</span>
            </div>
            {items.map((item) => (
              <div className="hub-inventory-row" key={item.id}>
                <div className="hub-inventory-product">
                  <span>{item.emoji || '📦'}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.brand || 'Local product'} · Updated {item.updatedMinsAgo} min ago
                    </small>
                  </div>
                </div>
                <div className="hub-inventory-price" data-label="Price">
                  {rupees(item.price)}
                </div>
                <div className="hub-inventory-available" data-label="Available">
                  {item.availableQuantity}{' '}
                  <small>{item.reservedQuantity ? `${item.reservedQuantity} reserved` : 'to sell'}</small>
                </div>
                <div className="hub-inventory-edit">
                  <label className="sr-only" htmlFor={`stock-${item.id}`}>
                    Total stock for {item.name}
                  </label>
                  <input
                    id={`stock-${item.id}`}
                    type="number"
                    min={item.reservedQuantity}
                    max={99999}
                    value={draft[item.id] ?? item.quantity}
                    onChange={(e) => setDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => void save(item)}
                    disabled={
                      working === item.id ||
                      draft[item.id] === undefined ||
                      Number(draft[item.id]) === item.quantity ||
                      !draft[item.id]
                    }
                  >
                    {working === item.id ? 'Saving' : 'Save'}
                  </button>
                </div>
                <div className="hub-inventory-status">
                  <StatusPill
                    status={
                      item.availableQuantity === 0
                        ? 'OUT_OF_STOCK'
                        : item.availableQuantity <= 4
                          ? 'LOW_STOCK'
                          : 'IN_STOCK'
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <HubEmpty
            title={query || filter !== 'all' ? 'No matching products' : 'Your shelves are waiting'}
            body={
              query || filter !== 'all'
                ? 'Try a different search or filter.'
                : 'Once products are added to your store, you can manage their stock here.'
            }
          />
        )}
      </div>
    </div>
  )
}
