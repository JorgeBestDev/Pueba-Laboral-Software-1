import { useEffect, useState } from 'react'
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-md border border-neutral-200 bg-white p-8 ${className}`}>{children}</div>
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white p-6 transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <h2 className="font-display text-lg uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-black" aria-label="Cerrar">
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
    default: 'bg-black text-white',
    success: 'bg-neutral-800 text-white',
    warning: 'bg-amber-500 text-white',
    danger: 'bg-red-600 text-white',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function GlassButton({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'icon' }) {
  const styles = {
    primary: 'bg-black text-white hover:bg-neutral-800 border border-black',
    ghost: 'border border-neutral-300 bg-white text-black hover:border-black',
    icon: 'border border-neutral-300 bg-white text-black hover:border-black rounded-full',
  }
  return (
    <button className={`glass-button ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function GlassInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input className={`glass-input ${className}`} {...props} />
}

export function PasswordInput({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: React.Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`glass-input w-full pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-neutral-500 hover:text-black"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <IconEye /> : <IconEyeOff />}
      </button>
    </div>
  )
}

export function Stars({ value }: { value: number | null }) {
  return (
    <span className="text-amber-500" aria-label={`${value ?? 0} de 5 estrellas`}>
      {'★'.repeat(Math.round(value ?? 0))}
      <span className="text-neutral-300">{'★'.repeat(5 - Math.round(value ?? 0))}</span>
    </span>
  )
}

export function SectionHeader({
  title,
  italicWord,
  onPrev,
  onNext,
  viewAllHref,
}: {
  title: string
  italicWord?: string
  onPrev?: () => void
  onNext?: () => void
  viewAllHref?: string
}) {
  const titleParts = italicWord ? title.split(italicWord) : [title]

  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <h2 className="section-heading">
        {italicWord ? (
          <>
            {titleParts[0]}
            <em className="not-italic font-display italic">{italicWord}</em>
            {titleParts[1] ?? ''}
          </>
        ) : (
          title
        )}
      </h2>
      <div className="flex shrink-0 items-center gap-4">
        {viewAllHref && (
          <a href={viewAllHref} className="text-[0.65rem] font-semibold uppercase tracking-widest underline underline-offset-4 hover:opacity-70">
            Ver todo
          </a>
        )}
        {(onPrev || onNext) && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPrev}
              className="flex h-8 w-8 items-center justify-center border border-neutral-300 text-sm hover:border-black"
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex h-8 w-8 items-center justify-center border border-neutral-300 text-sm hover:border-black"
              aria-label="Siguiente"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function IconSearch({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

export function IconUser({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

export function IconBag({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}

export function IconEye({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5.25 12 5.25S20.268 7.943 21.542 12C20.268 16.057 16.477 18.75 12 18.75S3.732 16.057 2.458 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

export function IconEyeOff({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.84 2.84M9.88 5.09A10.94 10.94 0 0112 4.75c4.477 0 8.268 2.693 9.542 7.25a10.96 10.96 0 01-4.098 5.54M6.61 6.61A10.96 10.96 0 002.458 12C3.732 16.057 7.523 18.75 12 18.75c.73 0 1.44-.07 2.12-.2" />
    </svg>
  )
}
