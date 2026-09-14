import { useState } from 'react'
import type { FormEvent } from 'react'
import { createAiInteraction } from '../lib/api'
import { GlassButton, GlassInput, GlassPanel } from './ui'

type Message = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Recomiéndame algo para regalar',
  '¿Qué producto tiene mejores reseñas?',
  'Busco algo económico y disponible ahora',
]

export function AIWidget() {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hola 👋 Soy el asistente de Vokter. Puedo ayudarte a encontrar productos, comparar opciones o resolver dudas sobre tu pedido.',
    },
  ])
  const [sending, setSending] = useState(false)

  async function send(text: string) {
    if (!text.trim() || sending) return
    setMessages((current) => [...current, { role: 'user', content: text }])
    setPrompt('')
    setSending(true)
    try {
      const result = await createAiInteraction({ use_case: 'shopping_assistant', prompt: text })
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            result.status === 'pending'
              ? 'Recibí tu consulta y la estoy procesando. Muy pronto conectaremos un modelo generativo real para responder en vivo.'
              : 'Gracias por tu mensaje.',
        },
      ])
    } catch {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'No pude conectar con el asistente ahora mismo. Intenta de nuevo en unos segundos.' },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send(prompt)
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <GlassPanel className="flex h-[28rem] w-[22rem] flex-col rounded-3xl p-4 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <p className="text-sm font-semibold text-cyan-100">Vokter AI</p>
              <p className="text-xs text-slate-500">Concierge de compras</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar asistente">
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto py-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-cyan-300 text-slate-950'
                    : 'border border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {message.content}
              </div>
            ))}
            {sending && <div className="max-w-[70%] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">Escribiendo…</div>}
          </div>
          {messages.length === 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <GlassInput
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Escribe tu pregunta…"
            />
            <GlassButton type="submit" disabled={sending} className="px-4">
              ➤
            </GlassButton>
          </form>
        </GlassPanel>
      )}
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/15 text-2xl text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.25)] backdrop-blur-lg transition hover:bg-cyan-300/25"
        aria-label="Abrir asistente de IA"
      >
        ✨
      </button>
    </div>
  )
}
