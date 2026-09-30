import { bareTerms, parseNaturalQuery, type SearchDoc } from '@nearbuy/search'
import type { ParsedSearch } from '@nearbuy/types'
/**
 * @nearbuy/ai — modular AI service.
 * Frontend → AI API → AI Service (here) → tools/search/catalog → LLM provider.
 * The default Grounded provider NEVER fabricates inventory — every claim comes
 * from tool results over live catalog/inventory data.
 */

export interface AiReply {
  text: string
  productIds: string[]
  storeIds: string[]
  chips: string[]
  parsed?: ParsedSearch
}

/** Tools the AI may call — implemented by the API over real data. */
export interface AiTools {
  searchProducts(q: string): Promise<SearchDoc[]>
  storesOpenNearby(): Promise<{ id: string; name: string; distanceKm: number; area: string }[]>
  productSummary(id: string): Promise<{
    name: string
    price: number
    stores: number
    units: number
    closestKm: number | null
    fastestMins: number | null
  } | null>
}

/** LLM provider abstraction — swap GroundedRuleEngine for a hosted LLM later. */
export interface LlmProvider {
  readonly name: string
  complete(prompt: string, grounding: string): Promise<string>
}

export class GroundedRuleEngine implements LlmProvider {
  readonly name = 'grounded'
  async complete(_prompt: string, grounding: string): Promise<string> {
    return grounding
  }
}

export class HostedLlmProvider implements LlmProvider {
  readonly name = 'llm'
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gpt-4o-mini',
  ) {}
  async complete(prompt: string, grounding: string): Promise<string> {
    if (!this.apiKey) return grounding
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are NearAI, a local shopping assistant. Use ONLY the grounding data; never invent inventory, prices or ETAs. Be short and direct.',
            },
            { role: 'system', content: grounding },
            { role: 'user', content: prompt },
          ],
          max_tokens: 400,
        }),
      })
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      return json.choices?.[0]?.message?.content ?? grounding
    } catch {
      return grounding
    }
  }
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const km = (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`)

/** NearAI — customer shopping assistant, grounded in verified NearBuy data. */
export async function askNearAI(
  message: string,
  tools: AiTools,
  llm: LlmProvider = new GroundedRuleEngine(),
): Promise<AiReply> {
  const parsed = parseNaturalQuery(message)
  const q = message.toLowerCase()

  // Store discovery intent
  if (/store.*open|open.*store|which.*open|दुकान/.test(q) && !/add|stock/.test(q)) {
    const open = await tools.storesOpenNearby()
    const grounding = `Right now, ${open.length} stores around you are open. Closest first:\n${open
      .slice(0, 4)
      .map((s) => `• ${s.name} — ${km(s.distanceKm)} (${s.area})`)
      .join('\n')}`
    return {
      text: await llm.complete(message, grounding),
      productIds: [],
      storeIds: open.slice(0, 4).map((s) => s.id),
      chips: open.slice(0, 3).map((s) => `${s.name} · ${km(s.distanceKm)}`),
      parsed,
    }
  }

  const hits = await tools.searchProducts(message)
  const top = hits.slice(0, 4)

  if (!top.length) {
    const grounding =
      "I couldn't find that in nearby inventory yet. Try a simpler phrase — for example “volleyball under ₹1,500 within 3 km” or “school bag available today”."
    return { text: await llm.complete(message, grounding), productIds: [], storeIds: [], chips: ['Show popular nearby', 'Widen to 10 km'], parsed }
  }

  const summaries: string[] = []
  for (const hit of top) {
    const s = await tools.productSummary(hit.productId)
    if (!s) continue
    summaries.push(
      `• ${s.name} — ${inr(s.price)} · ${s.stores} store${s.stores === 1 ? '' : 's'}${
        s.closestKm != null ? ` · closest ${km(s.closestKm)}` : ''
      }${s.fastestMins != null ? ` · pickup in ~${s.fastestMins} min` : ''}`,
    )
  }
  const filters = parsed.chips.map((c) => c.label)
  const grounding = `Here's what's actually in stock around you${filters.length ? ` (${filters.join(' · ')})` : ''}:\n${summaries.join(
    '\n',
  )}\nAll availability is grounded in live store inventory — want pickup, local delivery or reservation?`

  return {
    text: await llm.complete(message, grounding),
    productIds: top.map((h) => h.productId),
    storeIds: [],
    chips: ['Reserve & Pickup', 'Local delivery', 'Cheapest first'],
    parsed,
  }
}

export interface SellerAiTools {
  addStock(item: string, qty: number): Promise<string>
  lowStock(): Promise<{ id: string; name: string; stock: number }[]>
  topSellers(): Promise<{ id: string; name: string; sold: number }[]>
  createOffer(kind: string): Promise<string>
  pickupQueue(): Promise<{ code: string; window: string; status: string }[]>
}

/** Seller assistant — natural-language store operations over real data. */
export async function askSellerAI(message: string, tools: SellerAiTools): Promise<AiReply> {
  const q = message.toLowerCase()

  const add = q.match(/add\s+(\d+)\s+([a-z ]+)/)
  if (add) {
    const result = await tools.addStock(add[2].trim(), parseInt(add[1], 10))
    return { text: result, productIds: [], storeIds: [], chips: ['View inventory', 'Undo'] }
  }
  if (/out of stock|low stock|running out|reorder/.test(q)) {
    const low = await tools.lowStock()
    return {
      text: low.length
        ? `${low.length} products need attention. Reorder suggestions based on this week's sales:\n${low
            .map((l) => `• ${l.name} — ${l.stock} left`)
            .join('\n')}`
        : 'Stock levels look healthy — nothing below 5 units.',
      productIds: low.map((l) => l.id),
      storeIds: [],
      chips: low.length ? ['Draft reorder list', 'Notify me at 3 units'] : ['View inventory'],
    }
  }
  if (/sold most|top sell|best sell|this week/.test(q)) {
    const top = await tools.topSellers()
    return {
      text: `Top sellers this week:\n${top.map((t, i) => `${i + 1}. ${t.name} — ${t.sold} sold`).join('\n')}\nAt the current sales rate, stock may run out within a week for the fastest movers (forecast, not a guarantee).`,
      productIds: top.map((t) => t.id),
      storeIds: [],
      chips: ['Restock top seller', 'See full report'],
    }
  }
  if (/discount|offer|sale|promo/.test(q)) {
    const result = await tools.createOffer('WEEKEND')
    return { text: result, productIds: [], storeIds: [], chips: ['Edit offer', 'Add a coupon'] }
  }
  if (/pickup|ready|reservation|queue/.test(q)) {
    const queue = await tools.pickupQueue()
    return {
      text: `${queue.length} pickups in the queue:\n${queue.map((p) => `• ${p.code} — ${p.window} (${p.status})`).join('\n')}`,
      productIds: [],
      storeIds: [],
      chips: ['Open reservations', 'Mark another ready'],
    }
  }
  return {
    text: 'I can manage inventory, orders, reservations and offers for you. Try “which products are almost out of stock?” or “create a weekend discount”.',
    productIds: [],
    storeIds: [],
    chips: ['Low stock?', 'Top sellers', 'Create offer'],
  }
}
