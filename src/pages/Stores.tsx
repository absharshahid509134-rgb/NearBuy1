import { useState } from 'react'
import { storeDistance } from '../lib/geo'
import { useCatalog } from '../store/CatalogContext'
import { StoreCard } from '../components/commerce'
import { Tabs } from '../components/ui'

export default function Stores() {
  const [cat, setCat] = useState<string>('all')
  const { stores, categories, status } = useCatalog()
  const list = stores.filter((s) => cat === 'all' || s.category === cat)

  if (status !== 'ready')
    return (
      <div className="nb-container py-16 grid place-items-center">
        <div className="flex items-center gap-3 text-neutral-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-brand-600 rounded-full animate-spin" />
          Loading the market…
        </div>
      </div>
    )

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div>
        <h1 className="text-m-h1 lg:text-h1">Stores</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          Local shops with digital storefronts — follow for new stock and offers.
        </p>
      </div>
      <div className="flex gap-2 nb-scroll-x pb-1">
        <button
          onClick={() => setCat('all')}
          className={`px-4 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap min-h-touch ${
            cat === 'all' ? 'bg-primary-500 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`px-4 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap min-h-touch ${
              cat === c.id ? 'bg-primary-500 text-white' : 'bg-white border border-neutral-200 text-neutral-600'
            }`}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...list]
          .sort((a, b) => storeDistance(a) - storeDistance(b))
          .map((s) => (
            <StoreCard key={s.id} storeId={s.id} />
          ))}
      </div>
    </div>
  )
}
