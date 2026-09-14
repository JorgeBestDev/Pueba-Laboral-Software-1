import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../lib/admin-auth-context'

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [{ to: '/admin', label: 'Dashboard', end: true, icon: IconGrid }],
  },
  {
    label: 'Ventas',
    items: [{ to: '/admin/pedidos', label: 'Pedidos', end: false, icon: IconBag }],
  },
  {
    label: 'Catálogo',
    items: [{ to: '/admin/productos', label: 'Productos', end: false, icon: IconBox }],
  },
  {
    label: 'Personas',
    items: [{ to: '/admin/clientes', label: 'Clientes', end: false, icon: IconUsers }],
  },
]

function IconGrid({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

function IconBag({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
    </svg>
  )
}

function IconBox({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-8.25-4.5L3.75 7.5m16.5 0l-8.25 4.5m8.25-4.5v9l-8.25 4.5m0-9L3.75 7.5m8.25 4.5v9m-8.25-9v9l8.25 4.5" />
    </svg>
  )
}

function IconUsers({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { admin, logout } = useAdminAuth()
  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-black text-white">
      <Link to="/admin" className="font-display border-b border-white/10 px-6 py-5 text-lg italic tracking-tight text-white">
        vokter<span className="text-cyan-400">.</span>
        <span className="ml-1 align-middle text-[0.6rem] font-sans font-semibold uppercase tracking-widest text-neutral-400">
          admin
        </span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-2 text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'border-l-2 border-white bg-neutral-900 text-white'
                        : 'border-l-2 border-transparent text-neutral-400 hover:bg-neutral-900 hover:text-white'
                    }`
                  }
                >
                  <item.icon />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-semibold text-white">
          {admin?.first_name} {admin?.last_name}
        </p>
        <p className="truncate text-xs text-neutral-400">{admin?.email}</p>
        <div className="mt-3 flex gap-2">
          <Link to="/" className="pill-btn flex-1 justify-center !text-black !bg-white/90 hover:!bg-white">
            Ver tienda
          </Link>
          <button type="button" onClick={logout} className="pill-btn flex-1 justify-center bg-white/10 hover:bg-white/20">
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/pedidos': 'Pedidos',
  '/admin/productos': 'Productos',
  '/admin/clientes': 'Clientes',
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { admin } = useAdminAuth()
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Panel administrativo'

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="p-2 text-black lg:hidden"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <h1 className="font-display text-xl">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-neutral-500 sm:inline">Hola, {admin?.first_name ?? 'admin'}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
          {(admin?.first_name?.[0] ?? 'A').toUpperCase()}
        </span>
      </div>
    </header>
  )
}

export function AdminLayout() {
  const { admin, loading } = useAdminAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (loading) return null
  if (!admin) return <Navigate to="/admin/login" replace />

  return (
    <div className="flex min-h-screen bg-neutral-50 text-black">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 h-full">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
