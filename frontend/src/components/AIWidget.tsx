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
        <GlassPanel className="flex h-[28rem] w-[22rem] flex-col border border-neutral-200 p-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div>
              <p className="font-display text-sm italic">Vokter AI</p>
              <p className="text-xs text-neutral-500">Concierge de compras</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-neutral-500 hover:text-black" aria-label="Cerrar asistente">
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto py-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[85%] px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-black text-white'
                    : 'border border-neutral-200 bg-neutral-50 text-neutral-800'
                }`}
              >
                {message.content}
              </div>
            ))}
            {sending && <div className="max-w-[70%] border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">Escribiendo…</div>}
          </div>
          {messages.length === 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-black hover:text-black"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <GlassInput value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Escribe tu pregunta…" />
            <GlassButton type="submit" disabled={sending} className="px-4">
              ➤
            </GlassButton>
          </form>
        </GlassPanel>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center bg-black text-2xl text-white shadow-lg transition hover:bg-neutral-800"
        aria-label="Abrir asistente de IA"
      >
        ✨
      </button>
    </div>
  )
}
