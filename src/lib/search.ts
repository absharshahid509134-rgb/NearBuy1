import { liveCatalog } from './liveCatalog'
import type { Product, Store } from '../data/types'
import { storeDistance } from './geo'

/**
 * NearBuy search engine — parses natural-language queries into structured
 * filters ("school bag under ₹1500 within 3 km, available today") and
 * searches catalog + live inventory.
 */

export interface ParsedQuery {
  raw: string
  text: string
  maxPrice?: number
  minPrice?: number
  maxDistanceKm?: number
  openNow: boolean
  availableToday: boolean
  pickup: boolean
  fast: boolean
  intent: 'product' | 'store' | 'compare' | 'gift' | 'unknown'
  chips: { label: string; kind: 'price' | 'distance' | 'availability' | 'store' | 'mode' }[]
}

export interface SearchHit {
  product: Product
  score: number
  storesNearby: number
  minPrice: number
  closestKm: number
  openNow: boolean
  pickupToday: boolean
}

export function parseQuery(raw: string): ParsedQuery {
  const q = raw.toLowerCase()
  const parsed: ParsedQuery = {
    raw,
    text: raw.trim(),
    openNow: false,
    availableToday: false,
    pickup: false,
    fast: false,
    intent: 'product',
    chips: [],
  }

  const price = q.match(/(?:under|below|less than|upto|up to|<)\s*₹?\s*([\d,]+)/)
  if (price) {
    parsed.maxPrice = parseInt(price[1].replace(/,/g, ''), 10)
    parsed.chips.push({ label: `Under ₹${parsed.maxPrice.toLocaleString('en-IN')}`, kind: 'price' })
  }
  const minPrice = q.match(/(?:above|over|more than|>)\s*₹?\s*([\d,]+)/)
  if (minPrice) {
    parsed.minPrice = parseInt(minPrice[1].replace(/,/g, ''), 10)
    parsed.chips.push({ label: `Above ₹${parsed.minPrice.toLocaleString('en-IN')}`, kind: 'price' })
  }
  const dist = q.match(/within\s*([\d.]+)\s*(km|kilomet|m|meter)/)
  if (dist) {
    let km = parseFloat(dist[1])
    if (/m|meter/.test(dist[2]) && !/km|kilomet/.test(dist[2])) km = km / 1000
    parsed.maxDistanceKm = km
    parsed.chips.push({ label: `Within ${km} km`, kind: 'distance' })
  }
  if (/open now|open right now|open tonight|tonight|right now/.test(q)) {
    parsed.openNow = true
    parsed.chips.push({ label: 'Open now', kind: 'store' })
  }
  if (/available today|in stock today|today\b|collect today|pickup today/.test(q)) {
    parsed.availableToday = true
    parsed.chips.push({ label: 'Available today', kind: 'availability' })
  }
  if (/pickup|pick up|collect|walk/.test(q)) {
    parsed.pickup = true
    parsed.chips.push({ label: 'Pickup', kind: 'mode' })
  }
  if (/fast|urgent|quickly|asap|in a hurry/.test(q)) {
    parsed.fast = true
    parsed.chips.push({ label: 'Fastest', kind: 'mode' })
  }
  if (/gift|present|birthday/.test(q)) parsed.intent = 'gift'
  if (/compare|vs\b|versus/.test(q)) parsed.intent = 'compare'
  if (/store|shop\b|seller/.test(q) && !/find|get|need|buy/.test(q)) parsed.intent = 'store'

  return parsed
}

/** Strip the structured filter phrases so the remainder matches product text. */
function bareTerms(parsed: ParsedQuery): string {
  return parsed.raw
    .toLowerCase()
    .replace(/₹\s?[\d,]+/g, ' ')
    .replace(/under|below|less than|upto|up to|above|over|more than|within\s*[\d.]+\s*(km|kilomet|m|meter)?/g, ' ')
    .replace(/open now|open right now|right now|tonight|available today|collect today|pickup today|today|pickup|pick up|collect|fast|urgent|quickly|asap|gift|please|me|a|an|the|find|for|nearby|near|within/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function runSearch(raw: string, opts?: { mode?: string }): SearchHit[] {
  const parsed = parseQuery(raw)
  const terms = bareTerms(parsed).split(' ').filter((t) => t.length > 2)
  const mode = opts?.mode

  const hits: SearchHit[] = []
  for (const p of liveCatalog().products) {
    let score = 0
    const hay = `${p.name} ${p.brand} ${p.category} ${p.tags.join(' ')}`.toLowerCase()
    for (const t of terms) {
      if (hay.includes(t)) score += 10
      if (p.name.toLowerCase().includes(t)) score += 8
    }
    if (parsed.intent === 'gift' && (p.tags.includes('gift') || p.category === 'gifts')) score += 14
    if (parsed.availableToday && p.tags.includes('urgent')) score += 4

    const listings = liveCatalog().listings.filter((l) => l.productId === p.id && l.stock > 0).map((l) => ({
      l,
      s: liveCatalog().stores.find((s) => s.id === l.storeId)!,
    }))
    const minPrice = Math.min(p.price, ...listings.map((x) => x.l.price))
    const closestKm = listings.length
      ? Math.min(...listings.map((x) => storeDistance(x.s)))
      : 99
    const openNow = listings.some((x) => x.s.open)
    const pickupToday = listings.some((x) => x.s.open && x.s.pickup && x.l.stock > 0)

    // structured filter enforcement
    if (parsed.maxPrice && minPrice > parsed.maxPrice) continue
    if (parsed.minPrice && minPrice < parsed.minPrice) continue
    if (parsed.maxDistanceKm && closestKm > parsed.maxDistanceKm) continue
    if ((parsed.openNow || mode === 'fastest') && !openNow) continue
    if (parsed.availableToday && !pickupToday) continue
    if ((parsed.pickup || mode === 'nearby') && !pickupToday) score -= 6

    if (mode === 'price') score += (5000 - minPrice) / 500
    if (mode === 'nearby') score += (5 - closestKm) * 4
    if (mode === 'fastest' && pickupToday) score += 8

    if (score <= 0 && terms.length) continue
    if (!terms.length && !parsed.maxPrice && !parsed.maxDistanceKm) score += 1

    hits.push({
      product: p,
      score,
      storesNearby: listings.length,
      minPrice,
      closestKm,
      openNow,
      pickupToday,
    })
  }

  if (mode === 'price') hits.sort((a, b) => a.minPrice - b.minPrice)
  else if (mode === 'nearby') hits.sort((a, b) => a.closestKm - b.closestKm)
  else if (mode === 'fastest') hits.sort((a, b) => Number(b.pickupToday) - Number(a.pickupToday) || a.closestKm - b.closestKm)
  else hits.sort((a, b) => b.score - a.score)
  return hits
}

export function searchStores(raw: string): Store[] {
  const q = raw.toLowerCase()
  return liveCatalog().stores.filter((s) => {
    const hay = `${s.name} ${s.category} ${s.area} ${s.blurb}`.toLowerCase()
    return q.split(' ').some((t) => t.length > 2 && hay.includes(t))
  }).sort((a, b) => storeDistance(a) - storeDistance(b))
}

export function suggestionsFor(prefix: string): string[] {
  const q = prefix.toLowerCase().trim()
  if (!q) return ['volleyball', 'school bag', 'printer ink', 'gift under ₹1,000', 'headphones']
  const pool = [...liveCatalog().products.map((p) => p.name.toLowerCase()), 'football shoes', 'birthday gift', 'school supplies']
  return pool.filter((s) => s.includes(q)).slice(0, 5)
}
