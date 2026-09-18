import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, askAssistant } from '../lib/api'
import { GlassButton, GlassInput, GlassPanel } from './ui'

type Message = {
  role: 'user' | 'assistant'
  content: string
  model?: string | null
}

const SUGGESTIONS = [
  'Recomiéndame algo para regalar',
  '¿Qué producto tiene mejores reseñas?',
  'Busco algo económico y disponible',
  '¿Cómo funcionan los envíos?',
]

// ---------------------------------------------------------------------------
// Minimal Markdown renderer (bold + links only — no extra deps)
// Handles: **bold**, [text](url), and plain text.
// Internal links (same host or relative) use React Router <Link>.
// ---------------------------------------------------------------------------
function productPathFromHref(href: string): string | null {
  try {
    const path = new URL(href, window.location.origin).pathname
    const match = path.match(/^\/products\/([^/]+)$/)
    return match ? `/products/${match[1]}` : null
  } catch {
    return null
  }
}

function MarkdownLine({ text }: { text: string }) {
  // Split on **bold** and [text](url) tokens
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/)
  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          return <strong key={i}>{token.slice(2, -2)}</strong>
        }
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (linkMatch) {
          const [, label, href] = linkMatch
          const productPath = productPathFromHref(href)
          // Determine if internal (relative or same origin)
          const isInternal =
            productPath !== null ||
            href.startsWith('/') ||
            href.startsWith(window.location.origin)
          const path = productPath ?? (isInternal
            ? href.replace(window.location.origin, '')
            : href
          )
          return isInternal ? (
            <Link
              key={i}
              to={path}
              className="font-medium text-black underline underline-offset-2 hover:text-neutral-600"
            >
              {label}
            </Link>
          ) : (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black underline underline-offset-2 hover:text-neutral-600"
            >
              {label}
            </a>
          )
        }
        return <span key={i}>{token}</span>
      })}
    </>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  // Split into lines; lines starting with "- " become list items
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: number) => {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`ul-${key}`} className="my-1 space-y-0.5 pl-4">
        {listItems.map((item, idx) => (
          <li key={idx} className="list-disc">
            <MarkdownLine text={item} />
          </li>
        ))}
      </ul>,
    )
    listItems = []
  }

  lines.forEach((line, idx) => {
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      listItems.push(line.replace(/^[-*•]\s/, ''))
    } else {
      flushList(idx)
      if (line.trim() === '') {
        elements.push(<br key={idx} />)
      } else {
        elements.push(
          <p key={idx} className="leading-relaxed">
            <MarkdownLine text={line} />
          </p>,
        )
      }
    }
  })
  flushList(lines.length)

  return <div className="space-y-0.5 text-sm">{elements}</div>
}

// ---------------------------------------------------------------------------

export function AIWidget({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hola 👋 Soy el asistente de Vokter. Puedo ayudarte a encontrar productos de nuestro catálogo, resolver dudas o recomendarte las mejores opciones.',
    },
  ])
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    if (!text.trim() || sending) return
    setMessages((current) => [...current, { role: 'user', content: text }])
    setPrompt('')
    setSending(true)
    try {
      const result = await askAssistant(text)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            result.response ||
            'Gracias por tu consulta. Puedes seguir explorando nuestro catálogo o preguntarme por productos específicos.',
          model: result.model,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            error instanceof ApiError && error.status < 500
              ? error.message
              : 'No pude conectar con el servicio de IA en este momento. Por favor intenta de nuevo en unos momentos.',
        },
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
        <GlassPanel className="flex h-[32rem] w-[23rem] flex-col border border-neutral-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div>
                <p className="font-display text-sm font-semibold tracking-wide">Concierge IA de Vokter</p>
                <p className="text-[0.65rem] text-neutral-500 uppercase tracking-wider">Asistente de compras en vivo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-black"
              aria-label="Cerrar asistente"
            >
              ✕
            </button>
          </div>

          {/* Messages body */}
          <div className="flex-1 space-y-3 overflow-y-auto py-3 pr-1 text-sm">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-sm px-3.5 py-2.5 leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-black text-white shadow-sm text-sm whitespace-pre-line'
                      : 'border border-neutral-200 bg-neutral-50 text-neutral-800'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownMessage content={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
                {message.model && message.role === 'assistant' && (
                  <span className="mt-1 text-[0.6rem] text-neutral-400 uppercase tracking-wider">
                    {message.model}
                  </span>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 max-w-[70%] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-500">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.3s]"></span>
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.15s]"></span>
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500"></span>
                <span className="ml-1">Consultando catálogo...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && !sending && (
            <div className="mb-2 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[0.7rem] text-neutral-600 transition hover:border-black hover:bg-neutral-100 hover:text-black"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-neutral-200">
            <GlassInput
              ref={inputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Pregunta sobre productos, marcas..."
              disabled={sending}
              className="text-xs"
            />
            <GlassButton type="submit" disabled={sending || !prompt.trim()} className="px-4 text-xs font-semibold">
              ➤
            </GlassButton>
          </form>
        </GlassPanel>
      )}

      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="group flex h-14 w-14 items-center justify-center bg-black text-white shadow-xl transition-transform hover:scale-105 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        aria-label="Abrir asistente de IA"
      >
        <span className="text-xl transition-transform group-hover:rotate-12">✨</span>
      </button>
    </div>
  )
}
