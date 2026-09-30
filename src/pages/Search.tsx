import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Compass, MapPin, Search as SearchIcon, Store as StoreIcon, Timer, Wallet, Wand2 } from 'lucide-react'
import { parseQuery, runSearch, searchStores } from '../lib/search'
import { formatINR, formatKm } from '../lib/format'
import { ProductCard, SearchBar, StoreRow } from '../components/commerce'
import { Button, EmptyState, ProductCardSkeleton, SectionHeading, Tabs } from '../components/ui'
import { useApp } from '../store/AppContext'
import { nearAiReply, aiMessage } from '../lib/nearai'
import type { ChatMessage } from '../data/types'

type Mode = 'product' | 'nearby' | 'price' | 'fastest' | 'store' | 'ai'

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'product', label: '🔎 Product Search', icon: <SearchIcon size={16} /> },
  { id: 'nearby', label: '📍 Nearby Search', icon: <MapPin size={16} /> },
  { id: 'price', label: '💰 Price Search', icon: <Wallet size={16} /> },
  { id: 'fastest', label: '⚡ Fastest Search', icon: <Timer size={16} /> },
  { id: 'store', label: '🏪 Store Search', icon: <StoreIcon size={16} /> },
  { id: 'ai', label: '🤖 AI Search', icon: <Wand2 size={16} /> },
]

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { recentSearches, pushSearch } = useApp()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [submitted, setSubmitted] = useState(params.get('q') ?? '')
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) ?? 'product')
  const [loading, setLoading] = useState(false)
  const [aiMsg, setAiMsg] = useState<ChatMessage | null>(null)

  useEffect(() => {
    const query = params.get('q')
    if (query) {
      setQ(query)
      setSubmitted(query)
    }
  }, [params])

  useEffect(() => {
    if (!submitted) return
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(t)
  }, [submitted, mode])

  const parsed = useMemo(() => parseQuery(submitted), [submitted])
  const hits = useMemo(
    () => (submitted ? runSearch(submitted, { mode }) : []),
    [submitted, mode],
  )
  const stores = useMemo(
    () => (submitted ? searchStores(submitted) : []),
    [submitted],
  )

  function onSearch(next?: string) {
    const query = next ?? q
    setSubmitted(query)
    pushSearch(query)
    setParams({ q: query, mode })
    if (mode === 'ai') {
      setAiMsg(aiMessage(nearAiReply(query)))
    }
  }

  function changeMode(m: Mode) {
    setMode(m)
    setParams({ q: submitted, mode: m })
    if (m === 'ai' && submitted) setAiMsg(aiMessage(nearAiReply(submitted)))
  }

  return (
    <div className="nb-container py-6 lg:py-10 space-y-6">
      <div>
        <h1 className="text-m-h1 lg:text-h1">Search</h1>
        <p className="text-body-sm text-neutral-500 mt-1">
          One query searches online sellers and real store shelves around you.
        </p>
      </div>

      <SearchBar value={q} onChange={setQ} onSubmit={() => onSearch()} />

      {/* search modes */}
      <div className="nb-scroll-x flex gap-2 pb-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => changeMode(m.id)}
            className={`inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-body-sm font-semibold whitespace-nowrap transition-colors duration-fast min-h-touch ${
              mode === m.id
                ? 'bg-primary-500 text-white shadow-soft'
                : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* structured filters converted from NL — NearBuy's smart search signature */}
      {submitted && parsed.chips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-white border border-primary-100 rounded-xl p-3.5">
          <span className="inline-flex items-center gap-1 text-caption font-bold text-primary-600 uppercase tracking-wide">
            <Wand2 size={14} /> Understood as
          </span>
          {parsed.chips.map((c) => (
            <span
              key={c.label}
              className="px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-caption font-semibold"
            >
              {c.label}
            </span>
          ))}
          <span className="text-caption text-neutral-400 ml-auto hidden sm:block">
            filters parsed automatically from your words
          </span>
        </div>
      )}

      {!submitted ? (
        <div className="space-y-6">
          <div className="nb-card p-5">
            <p className="text-body-sm font-semibold text-neutral-700 mb-3">Recent searches</p>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQ(s)
                    onSearch(s)
                  }}
                  className="px-3.5 h-9 rounded-full bg-neutral-100 text-neutral-600 text-body-sm font-medium hover:bg-neutral-200 min-h-touch"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <EmptyState
            icon="🔎"
            title="What do you need today?"
            body='Try “school bag under ₹1,500 within 3 km, preferably available today” — NearBuy turns it into structured filters.'
          />
        </div>
      ) : mode === 'ai' ? (
        <div className="nb-card p-6 bg-neutral-100/60">
          {aiMsg ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <p className="max-w-[80%] bg-primary-500 text-white rounded-2xl rounded-br-md px-4 py-3 text-m-body">
                  {submitted}
                </p>
              </div>
              <div className="max-w-[90%] bg-neutral-50 rounded-2xl rounded-bl-md px-4 py-3 border border-neutral-200">
                <p className="text-caption font-bold text-reserve mb-1">🤖 NEARAI</p>
                <p className="text-m-body text-neutral-900 whitespace-pre-line">{aiMsg.text}</p>
                {!!aiMsg.productIds?.length && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {aiMsg.productIds.map((id) => (
                      <ProductCard key={id} productId={id} compact />
                    ))}
                  </div>
                )}
                {!!aiMsg.storeIds?.length && (
                  <div className="space-y-2 mt-4">
                    {aiMsg.storeIds.map((id) => (
                      <StoreRow key={id} storeId={id} />
                    ))}
                  </div>
                )}
              </div>
              <Button variant="soft" size="md" onClick={() => navigate('/nearai')}>
                Continue in NearAI →
              </Button>
            </div>
          ) : null}
        </div>
      ) : mode === 'store' || (!hits.length && stores.length) ? (
        <section className="space-y-3">
          <SectionHeading title={`Stores matching “${submitted}”`} sub={`${stores.length} result(s)`} />
          {stores.length ? (
            stores.map((s) => <StoreRow key={s.id} storeId={s.id} />)
          ) : (
            <EmptyState icon="🏪" title="No stores found" body="Try a different name or browse Nearby." action="Open Nearby" onAction={() => navigate('/nearby')} />
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <SectionHeading
            title={`${hits.length} result${hits.length === 1 ? '' : 's'} for “${submitted}”`}
            sub={
              mode === 'price'
                ? 'Sorted by price — cheapest first'
                : mode === 'nearby'
                  ? 'Sorted by distance — nearest first'
                  : mode === 'fastest'
                    ? 'Sorted by pickup speed'
                    : 'Best match across nearby inventory'
            }
          />
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : hits.length ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {hits.map((h) => (
                <ProductCard key={h.product.id} productId={h.product.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🗺️"
              title="Nothing available nearby yet"
              body="Try increasing your search radius or choosing another category. NearAI can also watch for stock."
              action="Ask NearAI"
              onAction={() => navigate('/nearai')}
            />
          )}
        </section>
      )}
    </div>
  )
}
