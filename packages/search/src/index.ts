import type { ParsedSearch, SearchChip } from '@nearbuy/types'
/**
 * @nearbuy/search — natural-language query parsing + SearchEngine abstraction.
 * SQL engine queries the relational corpus; OpenSearch adapter slots in via config.
 */

// ── NL → structured filters ─────────────────────────────────────────────────
export function parseNaturalQuery(raw: string): ParsedSearch {
  const q = raw.toLowerCase()
  const chips: SearchChip[] = []
  const parsed: ParsedSearch = {
    raw,
    text: raw.trim(),
    openNow: false,
    availableToday: false,
    pickup: false,
    fast: false,
    chips,
  }

  const price = q.match(/(?:under|below|less than|upto|up to|<|कम)\s*(?:₹|rs\.?\s*)?\s*([\d,]+)/)
  if (price) {
    parsed.maxPrice = parseInt(price[1].replace(/,/g, ''), 10)
    chips.push({ label: `Under ₹${parsed.maxPrice.toLocaleString('en-IN')}`, kind: 'price' })
  }
  const minPrice = q.match(/(?:above|over|more than|>)\s*(?:₹|rs\.?\s*)?\s*([\d,]+)/)
  if (minPrice) {
    parsed.minPrice = parseInt(minPrice[1].replace(/,/g, ''), 10)
    chips.push({ label: `Above ₹${parsed.minPrice.toLocaleString('en-IN')}`, kind: 'price' })
  }
  const dist = q.match(/within\s*([\d.]+)\s*(km|kilomet(?:er)?s?|m|meters?)\b/)
  if (dist) {
    let km = parseFloat(dist[1])
    if (/^(m|meters?)$/.test(dist[2])) km = km / 1000
    parsed.maxDistanceKm = km
    chips.push({ label: `Within ${km} km`, kind: 'distance' })
  }
  const rating = q.match(/(?:rated|rating)\s*([\d.])\+?/)
  if (rating) {
    parsed.minRating = parseFloat(rating[1])
    chips.push({ label: `★ ${parsed.minRating}+`, kind: 'rating' })
  }
  const brand = q.match(
    /\b(nivia|sg|yonex|wildcraft|boat|noise|hp|mi|logitech|milton|camlin|classmate|campus|amul|century|wipro|tynor|oddy|faber(?:-castell)?)\b/,
  )
  if (brand) {
    parsed.brand = brand[1]
    chips.push({ label: `Brand: ${brand[1]}`, kind: 'brand' })
  }
  const cat = q.match(
    /\b(volleyball|cricket|badminton|football|shoes|backpack|bag|headphones|earbuds|charger|mouse|lamp|printer|ink|notebook|stationery|bottle|umbrella|milk|paper|gift|handmade|sports|electronics|fashion|grocery)\b/,
  )
  if (cat) {
    parsed.category = cat[1]
    chips.push({ label: `Category: ${cat[1]}`, kind: 'category' })
  }
  if (/open now|open right now|open tonight|tonight|right now|अभी/.test(q)) {
    parsed.openNow = true
    chips.push({ label: 'Open now', kind: 'store' })
  }
  if (/available today|in stock today|today\b|collect today|pickup today/.test(q)) {
    parsed.availableToday = true
    chips.push({ label: 'Available today', kind: 'availability' })
  }
  if (/pickup|pick up|collect|walk.?in/.test(q)) {
    parsed.pickup = true
    chips.push({ label: 'Pickup', kind: 'mode' })
  }
  if (/fast|urgent|quickly|asap|in a hurry/.test(q)) {
    parsed.fast = true
    chips.push({ label: 'Fastest', kind: 'mode' })
  }
  if (/near me|nearby|\bnear\b|पास/.test(q)) chips.push({ label: 'Nearby', kind: 'distance' })

  return parsed
}

/** Strip structured phrases so the remainder matches catalog text. */
export function bareTerms(parsed: ParsedSearch): string[] {
  return parsed.raw
    .toLowerCase()
    .replace(/[₹$]\s?[\d,]+/g, ' ')
    .replace(/under|below|less than|upto|up to|above|over|more than/g, ' ')
    .replace(/within\s*[\d.]+\s*(km|kilomet(?:er)?s?|m|meters?)?/g, ' ')
    .replace(
      /open now|open right now|right now|tonight|available today|collect today|pickup today|today|pickup|pick up|collect|walk.?in|fast|urgent|quickly|asap|near me|nearby|rating|rated/g,
      ' ',
    )
    .replace(/\b(me|a|an|the|find|for|with|and|please|under|के|की|का|पास)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 1)
}

// ── SearchEngine abstraction ────────────────────────────────────────────────
export interface SearchDoc {
  productId: string
  storeId?: string
  name: string
  brand?: string
  category?: string
  tags: string[]
  price: number
  distanceKm?: number
  rating: number
  availableNow: boolean
  pickupToday: boolean
  openNow?: boolean
}

export interface SearchRequest {
  parsed: ParsedSearch
  terms: string[]
  sort: string
  limit: number
  radiusKm: number
}

export interface SearchEngine {
  readonly name: string
  /** Optional external indexing — the SQL engine uses the relational tables directly. */
  index(docs: SearchDoc[]): Promise<void>
  query(req: SearchRequest, corpus: SearchDoc[]): Promise<SearchDoc[]>
}

function scoreDoc(doc: SearchDoc, req: SearchRequest): number {
  let score = 0
  const hay = `${doc.name} ${doc.brand ?? ''} ${doc.category ?? ''} ${doc.tags.join(' ')}`.toLowerCase()
  for (const term of req.terms) {
    if (hay.includes(term)) score += 10
    if (doc.name.toLowerCase().includes(term)) score += 8
  }
  if (req.parsed.brand && hay.includes(req.parsed.brand)) score += 14
  if (req.parsed.category && hay.includes(req.parsed.category)) score += 12
  if (doc.availableNow) score += 4
  if (doc.pickupToday) score += 3
  if (doc.distanceKm != null) score += Math.max(0, 8 - doc.distanceKm)
  return score
}

export class SqlSearchEngine implements SearchEngine {
  readonly name: string = 'sql'

  async index(_docs: SearchDoc[]): Promise<void> {
    // corpus = relational tables; nothing to replicate.
  }

  async query(req: SearchRequest, corpus: SearchDoc[]): Promise<SearchDoc[]> {
    const p = req.parsed
    const filtered = corpus.filter((doc) => {
      if (p.maxPrice && doc.price > p.maxPrice) return false
      if (p.minPrice && doc.price < p.minPrice) return false
      if (p.maxDistanceKm && (doc.distanceKm ?? 99) > p.maxDistanceKm) return false
      if (p.minRating && doc.rating < p.minRating) return false
      if ((p.openNow || req.sort === 'fastest') && doc.openNow === false) return false
      if (p.availableToday && !doc.pickupToday) return false
      if (p.brand && !`${doc.name} ${doc.brand ?? ''}`.toLowerCase().includes(p.brand)) return false
      if (
        p.category &&
        !`${doc.name} ${doc.category ?? ''} ${doc.tags.join(' ')}`.toLowerCase().includes(p.category)
      )
        return false
      if (doc.distanceKm != null && doc.distanceKm > req.radiusKm) return false
      return true
    })

    const scored = filtered.map((doc) => ({ doc, score: scoreDoc(doc, req) }))

    const sorters: Record<string, (a: (typeof scored)[0], b: (typeof scored)[0]) => number> = {
      recommended: (a, b) => b.score - a.score,
      cheapest: (a, b) => a.doc.price - b.doc.price,
      nearest: (a, b) => (a.doc.distanceKm ?? 99) - (b.doc.distanceKm ?? 99),
      rating: (a, b) => b.doc.rating - a.doc.rating,
      available: (a, b) =>
        Number(b.doc.availableNow) - Number(a.doc.availableNow) ||
        (a.doc.distanceKm ?? 99) - (b.doc.distanceKm ?? 99),
      fastest: (a, b) =>
        Number(b.doc.pickupToday) - Number(a.doc.pickupToday) ||
        (a.doc.distanceKm ?? 99) - (b.doc.distanceKm ?? 99),
    }
    const sort = sorters[req.sort] ?? sorters.recommended
    return scored
      .sort(sort)
      .slice(0, req.limit)
      .map((s) => s.doc)
  }
}

/** OpenSearch adapter — enabled when SEARCH_PROVIDER=opensearch. */
export class OpenSearchEngine extends SqlSearchEngine {
  override readonly name = 'opensearch'
  constructor(private readonly url?: string) {
    super()
  }
  override async index(docs: SearchDoc[]): Promise<void> {
    if (!this.url || !docs.length) return
    try {
      await fetch(`${this.url}/nearbuy/_doc/${docs[0].productId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(docs[0]),
      })
    } catch {
      /* indexing is async — queries fall back to SQL corpus */
    }
  }
}

export function createSearchEngine(kind: 'sql' | 'opensearch', url?: string): SearchEngine {
  return kind === 'opensearch' ? new OpenSearchEngine(url) : new SqlSearchEngine()
}
