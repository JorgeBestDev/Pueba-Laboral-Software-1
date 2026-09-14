import { useEffect } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass-panel ${className}`}>{children}</div>
}

export function Modal({
  open,
  onClose,
  children,
  className = '',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`glass-panel relative z-10 w-full max-w-md rounded-3xl p-6 ${className}`}>{children}</div>
    </div>
  )
}

export function Drawer({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title: string
}) {
  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`glass-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col rounded-l-3xl border-r-0 p-6 transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    default: 'border-cyan-200/20 bg-cyan-300/15 text-cyan-100',
    success: 'border-emerald-200/20 bg-emerald-300/15 text-emerald-100',
    warning: 'border-amber-200/20 bg-amber-300/15 text-amber-100',
    danger: 'border-rose-200/20 bg-rose-300/15 text-rose-100',
  }
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

export function GlassButton({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'icon' }) {
  const styles = {
    primary: 'bg-cyan-300 text-slate-950 hover:bg-cyan-200 shadow-lg shadow-cyan-500/20',
    ghost: 'border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:bg-white/10',
    icon: 'border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200',
  }
  return <button className={`glass-button ${styles[variant]} ${className}`} {...props}>{children}</button>
}

export function GlassInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="glass-input" {...props} />
}

export function Stars({ value }: { value: number | null }) {
  return <span className="text-amber-300" aria-label={`${value ?? 0} de 5 estrellas`}>
    {'★'.repeat(Math.round(value ?? 0))}<span className="text-slate-600">{'★'.repeat(5 - Math.round(value ?? 0))}</span>
  </span>
}
