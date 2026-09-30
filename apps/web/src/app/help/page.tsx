'use client'
import * as React from 'react'
import { useNearAI } from '@nearbuy/api'
import { Card, Button, Input, s, SectionHeader, Spinner } from '@nearbuy/ui'

interface ChatMsg { role: 'user' | 'bot'; text: string }

export default function HelpPage() {
  const nearai = useNearAI()
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([
    { role: 'bot', text: 'Hi! I am NearAI — ask me about orders, reservations, returns or anything nearby.' },
  ])
  const [text, setText] = React.useState('')
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const message = text.trim()
    if (!message) return
    setMsgs((m) => [...m, { role: 'user', text: message }])
    setText('')
    try {
      const r = await nearai.mutateAsync({ message })
      setMsgs((m) => [...m, { role: 'bot', text: r.reply }])
    } catch (err) {
      setMsgs((m) => [...m, { role: 'bot', text: err instanceof Error ? err.message : 'Sorry, I hit a snag.' }])
    }
  }

  return (
    <div className="nb-container max-w-3xl py-6">
      <SectionHeader title={s('nav.help', 'Help & Support')} />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: '↩️', t: s('help.returns', 'Returns & refunds'), d: s('help.returnsD', 'Eligibility → pickup → inspection → refund') },
          { icon: '📍', t: s('help.reservations', 'Reservations'), d: s('help.reservationsD', 'NB-#### codes, QR pickup, 3h holds') },
          { icon: '💬', t: s('help.human', 'Talk to a human'), d: s('help.humanD', 'AI → knowledge base → human hand-off') },
        ].map((c) => (
          <Card key={c.t} className="p-4">
            <p className="text-2xl">{c.icon}</p>
            <p className="mt-1 font-bold text-ink">{c.t}</p>
            <p className="text-xs text-ink-muted">{c.d}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 flex h-[480px] flex-col p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink">✨ {s('help.nearai', 'NearAI assistant')}</p>
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-primary-600 text-white' : 'bg-canvas text-ink'}`}>
              {m.text}
            </div>
          ))}
          {nearai.isPending && <div className="flex items-center gap-2 text-ink-muted"><Spinner className="h-4 w-4" /> …</div>}
        </div>
        <form onSubmit={(e) => void send(e)} className="mt-3 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={s('help.ask', 'Ask NearAI anything…')} aria-label={s('help.ask', 'Ask NearAI anything…')} />
          <Button type="submit" loading={nearai.isPending}>{s('help.send', 'Send')}</Button>
        </form>
      </Card>
    </div>
  )
}
