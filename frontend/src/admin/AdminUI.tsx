import type { ReactNode } from 'react'

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const accents: Record<string, string> = {
    default: 'text-black',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }
  return (
    <div className="glass-panel flex flex-col gap-2 p-5">
      <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-500">{label}</span>
      <span className={`font-display text-2xl md:text-3xl ${accents[tone]}`}>{value}</span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </div>
  )
}

export function AdminBadge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const tones: Record<string, string> = {
    default: 'bg-neutral-800 text-white',
    success: 'bg-emerald-500 text-white',
    warning: 'bg-amber-500 text-white',
    danger: 'bg-red-600 text-white',
    info: 'bg-neutral-200 text-neutral-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'completed':
    case 'paid':
    case 'authorized':
      return 'success'
    case 'pending':
      return 'warning'
    case 'cancelled':
    case 'failed':
    case 'refunded':
      return 'danger'
    case 'processing':
    case 'shipped':
      return 'info'
    default:
      return 'default'
  }
}

export function AdminPagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
      <span className="text-xs text-neutral-500">
        Página {page} de {pages}
      </span>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center border border-neutral-300 text-sm hover:border-black disabled:opacity-30"
        aria-label="Página anterior"
      >
        ‹
      </button>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center border border-neutral-300 text-sm hover:border-black disabled:opacity-30"
        aria-label="Página siguiente"
      >
        ›
      </button>
    </div>
  )
}

export function AdminEmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-neutral-500">{message}</div>
}
