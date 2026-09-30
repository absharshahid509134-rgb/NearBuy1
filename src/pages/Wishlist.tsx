import { Link, useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { getProduct, bestLocalPrice, foundNearby, listingsForProduct, storeDistance } from '../lib/geo'
import { formatINR, formatKm } from '../lib/format'
import { ProductVisual } from '../components/commerce'
import { Button, EmptyState, StatusBadge } from '../components/ui'
import { useApp } from '../store/AppContext'

/** Smart wishlist — price drops, nearby stock, store signals. */
export default function Wishlist() {
  const navigate = useNavigate()
  const { wishlist, toggleWishlist, toast } = useApp()

  // deterministic "insights" per item so the demo stays believable
  function insight(id: string, index: number): { label: string; kind: 'stock' | 'low' | 'ready' } {
    const f = foundNearby(id)
    const best = bestLocalPrice(id)
    if (index % 3 === 0 && best) return { label: `↓ Price changed · now ${formatINR(best.price)}`, kind: 'stock' }
    if (index % 3 === 1 && f.closestKm !== null)
      return { label: `📍 Available ${formatKm(f.closestKm)} away`, kind: 'ready' }
    return { label: `⚡ ${f.stores} stores have it today`, kind: 'low' }
  }

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div>
        <h1 className="text-m-h1 lg:text-h1">❤️ Wishlist</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          More than saved items — NearBuy watches price, stock and stores for you.
        </p>
      </div>

      {wishlist.length ? (
        <div className="space-y-3 max-w-3xl">
          {wishlist.map((id, i) => {
            const p = getProduct(id)
            const best = bestLocalPrice(id)
            const ins = insight(id, i)
            return (
              <div key={id} className="nb-card p-4 flex flex-wrap items-center gap-4">
                <Link to={`/product/${id}`}>
                  <ProductVisual product={p} className="w-20 h-20 aspect-none rounded-xl" />
                </Link>
                <div className="flex-1 min-w-[180px]">
                  <Link to={`/product/${id}`} className="text-body font-semibold text-neutral-900 hover:text-primary-600">
                    {p.name}
                  </Link>
                  <p className="font-data font-bold text-xl mt-1">{formatINR(best?.price ?? p.price)}</p>
                  <div className="mt-1.5">
                    <StatusBadge kind={ins.kind}>{ins.label}</StatusBadge>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={() => navigate(`/product/${id}?action=buy`)}>
                    Get It
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toggleWishlist(id)
                      toast({ kind: 'info', title: 'Removed from wishlist' })
                    }}
                  >
                    <Heart size={16} className="fill-deal text-deal" /> Remove
                  </Button>
                </div>
              </div>
            )
          })}
          <div className="nb-card p-5 bg-neutral-100/60">
            <p className="text-body-sm font-semibold text-neutral-700">Watching for you</p>
            <p className="text-body-sm text-neutral-500 mt-1">
              We'll notify on: price dropped · back in stock · nearby stock found · store opened · better option found.
            </p>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="❤️"
          title="Save things you love"
          body="Tap the heart on any product — NearBuy watches it for price drops and nearby stock."
          action="Explore products"
          onAction={() => navigate('/explore')}
        />
      )}
    </div>
  )
}
