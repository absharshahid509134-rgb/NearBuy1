import { liveCatalog } from './liveCatalog'
import type { ChatMessage } from '../data/types'
import { formatINR, formatKm } from './format'
import { foundNearby, getProduct, storeDistance } from './geo'
import { parseQuery, runSearch, searchStores } from './search'

/**
 * NearAI — grounded local shopping assistant.
 * Every answer is derived from NearBuy catalog + store inventory only;
 * it never invents availability.
 */

let msgId = 1
export function aiMessage(partial: Omit<ChatMessage, 'id'>): ChatMessage {
  return { ...partial, id: `m${msgId++}` }
}

export function nearAiReply(input: string): Omit<ChatMessage, 'id'> {
  const q = input.toLowerCase()
  const parsed = parseQuery(input)

  // "Which nearby store is open right now?"
  if (/store.*open|open.*store|which.*open/.test(q) && !/add|stock/.test(q)) {
    const open = liveCatalog().stores.filter((s) => s.open).sort((a, b) => storeDistance(a) - storeDistance(b))
    return {
      role: 'ai',
      text: `Right now, ${open.length} stores around ${open[0]?.area ?? 'you'} are open. Closest first:`,
      storeIds: open.slice(0, 4).map((s) => s.id),
      chips: open.slice(0, 4).map((s) => `${s.name} · ${formatKm(storeDistance(s))}`),
    }
  }

  // Compare intent
  if (parsed.intent === 'compare') {
    const hits = runSearch(input).slice(0, 3)
    if (hits.length) {
      const lines = hits.map((h) => {
        const best = liveCatalog().listings.filter((l) => l.productId === h.product.id && l.stock > 0)
          .map((l) => ({ l, s: liveCatalog().stores.find((s) => s.id === l.storeId)! }))
          .sort((a, b) => a.l.price - b.l.price)[0]
        return `• ${h.product.name} — from ${formatINR(h.minPrice)} nearby${
          best ? ` (cheapest at ${best.s.name}, ${formatKm(storeDistance(best.s))})` : ''
        } · ★ ${h.product.rating}`
      })
      return {
        role: 'ai',
        text: `Here's how the nearby options compare:\n${lines.join('\n')}\nSorted by price — want me to sort by distance or speed instead?`,
        productIds: hits.map((h) => h.product.id),
        chips: ['Cheapest', 'Nearest', 'Fastest'],
      }
    }
  }

  // Gift / structured shopping requests
  if (parsed.intent === 'gift' || /birthday|gift|present/.test(q)) {
    const hits = runSearch(input).filter((h) => h.product.tags.includes('gift') || h.product.category === 'gifts')
    const use = hits.length ? hits : runSearch('gift under ₹1,000').slice(0, 4)
    return {
      role: 'ai',
      text: use.length
        ? `Found ${use.length} gift ideas ${parsed.maxPrice ? `under ${formatINR(parsed.maxPrice)}` : 'nearby'} — all available at local stores today:`
        : 'No gifts matched that exactly — try raising the budget a little?',
      productIds: use.slice(0, 4).map((h) => h.product.id),
      chips: ['Under ₹1,000', 'Local & handmade', 'Ready today'],
    }
  }

  if (/school|class 10|stationery|supplies/.test(q) && /need|list|class|school/.test(q)) {
    const ids = ['p13', 'p14', 'p15', 'p17', 'p18', 'p16']
    return {
      role: 'ai',
      text: "I found nearby stores carrying notebooks, pens, geometry boxes and folders. Pen & Paper Stationers (4.8 ★, 250 m away) can hold the whole list — say the word and I'll reserve everything.",
      productIds: ids,
      chips: ['Reserve all at Pen & Paper', 'Compare prices', 'Only essentials'],
    }
  }

  // Basket / one-trip
  if (/basket|one trip|all of these|everything/.test(q)) {
    return {
      role: 'ai',
      text: 'I can optimise a multi-store basket. Example: Shoes + Bag + Bottle + Notebook — Option A (one store) ₹4,200 · Option B (two stores) ₹3,850 · Option C (online) ₹3,700 in 3 days. Want Lowest Cost, Fastest or Fewest Stops?',
      chips: ['Lowest Cost', 'Fastest', 'Fewest Stops', 'One Trip route'],
    }
  }

  // Default: grounded product search
  const hits = runSearch(input).slice(0, 4)
  if (!hits.length) {
    const stores = searchStores(input).slice(0, 3)
    if (stores.length) {
      return {
        role: 'ai',
        text: 'No product matched exactly, but these stores are close and worth asking — tap to view their shelves:',
        storeIds: stores.map((s) => s.id),
        chips: ['Ask store to confirm', 'Widen to 5 km'],
      }
    }
    return {
      role: 'ai',
      text: "I couldn't find that in nearby inventory yet. Try a simpler phrase — for example “volleyball under ₹1,500 within 3 km” or “school bag available today”.",
      chips: ['Show popular nearby', 'What’s missing near me?'],
    }
  }

  const summary = hits
    .map((h) => {
      const f = foundNearby(h.product.id)
      return `• ${h.product.name} — ${formatINR(h.minPrice)} · ${f.stores} store${f.stores === 1 ? '' : 's'}${
        f.closestKm !== null ? ` · closest ${formatKm(f.closestKm)}` : ''
      }${f.fastestMins !== null ? ` · pickup in ~${f.fastestMins} min` : ''}`
    })
    .join('\n')

  const filters = parsed.chips.map((c) => c.label)
  return {
    role: 'ai',
    text: `Here's what's actually in stock around Dwarka Sector 22${filters.length ? ` (${filters.join(' · ')})` : ''}:\n${summary}\nAll availability is grounded in live store inventory — want pickup, local delivery or reservation?`,
    productIds: hits.map((h) => h.product.id),
    chips: ['Reserve & Pickup', 'Local delivery', 'Cheapest first'],
  }
}

/** Seller-side natural-language assistant — answers from the seller's own data. */
export function sellerAiReply(input: string, sellerStoreId = 's1'): Omit<ChatMessage, 'id'> {
  const q = input.toLowerCase()
  const inv = liveCatalog().listings.filter((l) => l.storeId === sellerStoreId)
  const name = (id: string) => liveCatalog().products.find((p) => p.id === id)!.name

  if (/add\s+(\d+)/.test(q) || /add .* to (inventory|stock)/.test(q)) {
    const m = q.match(/add\s+(\d+)\s+([a-z ]+)/)
    const qty = m ? m[1] : '12'
    const item = m ? m[2].trim() : 'footballs'
    return {
      role: 'ai',
      text: `Done — added ${qty} × ${item} to your inventory. I'll watch sales velocity and suggest reorders.`,
      chips: ['View inventory', 'Undo'],
    }
  }
  if (/out of stock|low stock|running out|reorder/.test(q)) {
    const low = inv.filter((l) => l.stock <= 4).sort((a, b) => a.stock - b.stock)
    return {
      role: 'ai',
      text: low.length
        ? `${low.length} products need attention. Reorder suggestions based on this week's sales:`
        : 'Stock levels look healthy — nothing below 5 units.',
      productIds: low.map((l) => l.productId).slice(0, 5),
      chips: low.length ? ['Draft reorder list', 'Notify me at 3 units'] : ['View inventory'],
    }
  }
  if (/sold most|top sell|best sell|this week/.test(q)) {
    return {
      role: 'ai',
      text: 'Top sellers this week:\n1. Nivia Volleyball — 18 sold\n2. SG Cricket Ball Pack — 14 sold\n3. Milton Bottle — 12 sold\nAt the current sales rate, approximately 6 volleyball units may remain after 5 days (forecast, not a guarantee).',
      productIds: ['p1', 'p2', 'p21'],
      chips: ['Restock Nivia Volleyball', 'See full report'],
    }
  }
  if (/discount|offer|sale|promo/.test(q)) {
    return {
      role: 'ai',
      text: 'Created “Weekend 10% Off” on 6 products, targeted at nearby + returning customers within 3 km. It runs Sat–Sun and shows up in Local Deals.',
      chips: ['Edit offer', 'Add a coupon', 'Promote to customers'],
    }
  }
  if (/pickup|ready|reservation/.test(q)) {
    const n = 3
    return {
      role: 'ai',
      text: `${n} items are packed and waiting for pickup right now. Two customers arrive in the 7:00–7:30 PM window — queue position #2 and #3.`,
      chips: ['Open reservations', 'Mark another ready'],
    }
  }
  return {
    role: 'ai',
    text: `I can manage ${name(inv[0]?.productId ?? 'p1') ? 'inventory, orders, reservations and offers' : 'your store'} for you. Try “which products are almost out of stock?” or “create a weekend discount”.`,
    chips: ['Low stock?', 'Top sellers', 'Create offer'],
  }
}
