import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, Send } from 'lucide-react'
import type { ChatMessage } from '../data/types'
import { NEARAI_PROMPTS } from '../data/catalog'
import { aiMessage, nearAiReply } from '../lib/nearai'
import { ProductCard, StoreRow } from '../components/commerce'
import { Button } from '../components/ui'

/** NearAI — the local shopping assistant, grounded in real catalog + inventory. */
export default function NearAI() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([
    aiMessage({
      role: 'ai',
      text: "Hi, I'm NearAI 🤖 — your local shopping assistant. I only answer from real inventory at stores around Dwarka Sector 22. What do you need?",
      chips: NEARAI_PROMPTS.slice(0, 3),
    }),
  ])
  const [input, setInput] = useState(params.get('q') ?? '')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  function send(text: string) {
    const q = text.trim()
    if (!q) return
    setInput('')
    setMessages((m) => [...m, aiMessage({ role: 'user', text: q })])
    setThinking(true)
    setTimeout(() => {
      setMessages((m) => [...m, aiMessage(nearAiReply(q))])
      setThinking(false)
    }, 550)
  }

  useEffect(() => {
    const q = params.get('q')
    if (q) send(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10 flex flex-col min-h-[calc(100vh-200px)]">
      {/* header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-reserve flex items-center justify-center text-2xl shadow-soft">
          🤖
        </span>
        <div>
          <h1 className="text-h4 font-bold flex items-center gap-2">
            NearAI <Sparkles size={18} className="text-reserve" />
          </h1>
          <p className="text-caption text-neutral-500">Your Local Shopping Assistant · grounded in live inventory</p>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-4 nb-card bg-neutral-100/50 p-4 lg:p-6">
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[80%] bg-primary-500 text-white rounded-2xl rounded-br-md px-4 py-3 text-m-body">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-soft">
                <p className="text-caption font-bold text-reserve mb-1">🤖 NEARAI</p>
                <p className="text-m-body text-neutral-900 whitespace-pre-line">{m.text}</p>
                {!!m.productIds?.length && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {m.productIds.map((id) => (
                      <ProductCard key={id} productId={id} compact />
                    ))}
                  </div>
                )}
                {!!m.storeIds?.length && (
                  <div className="space-y-2 mt-4">
                    {m.storeIds.map((id) => (
                      <StoreRow key={id} storeId={id} />
                    ))}
                  </div>
                )}
              </div>
              {!!m.chips?.length && (
                <div className="flex flex-wrap gap-2 mt-2 ml-1">
                  {m.chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => send(c)}
                      className="px-3.5 h-9 rounded-full bg-white border border-primary-200 text-primary-600 text-caption font-semibold hover:bg-primary-50 min-h-touch"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <div className="max-w-[60%] bg-white border border-neutral-200 rounded-2xl rounded-bl-md px-4 py-3">
            <p className="text-caption text-neutral-400">NearAI is checking nearby stock…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* suggested prompts */}
      {messages.length <= 2 && (
        <div className="mt-4">
          <p className="text-caption font-semibold text-neutral-500 mb-2">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {NEARAI_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="px-3.5 h-10 rounded-full bg-white border border-neutral-200 text-body-sm text-neutral-700 hover:border-primary-300 hover:text-primary-600 transition-colors duration-fast min-h-touch"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="mt-4 flex items-center gap-3 h-[52px] px-4 rounded-xl border border-neutral-200 bg-white shadow-search"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything — “football shoes tonight”…"
          className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-neutral-400 min-w-0"
        />
        <button
          type="submit"
          className="w-10 h-10 rounded-lg bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors duration-fast min-h-touch min-w-touch"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>
      <p className="text-caption text-neutral-400 mt-2 text-center">
        NearAI never invents availability — every answer comes from NearBuy catalog & store inventory.
      </p>
    </div>
  )
}
