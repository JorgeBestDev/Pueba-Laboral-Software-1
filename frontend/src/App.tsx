import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AIWidget } from './components/AIWidget'
import { AuthModal } from './components/AuthModal'
import { CartDrawer } from './components/CartDrawer'
import { IconBag, IconSearch, IconUser } from './components/ui'
import { useAuth } from './lib/auth-context'
import { useCart } from './lib/cart-context'
import { AccountPage } from './pages/AccountPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderTrackerPage } from './pages/OrderTrackerPage'
import { ProductDetailPage } from './pages/ProductDetailPage'

const NAV_LINKS = [
  { label: 'New arrivals', href: '/#new' },
  { label: 'Bestsellers', href: '/#catalog' },
  { label: 'Explore', href: '/#catalog' },
  { label: 'AI concierge', href: '#ai' },
  { label: 'Mobile app', href: '#mobile' },
]

function Header({ onOpenAuth, onOpenSearch }: { onOpenAuth: () => void; onOpenSearch: () => void }) {
  const { isAuthenticated } = useAuth()
  const { itemCount, openDrawer } = useCart()

  return (
    <header className="sticky top-0 z-30 bg-black">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link className="font-display shrink-0 text-xl italic tracking-tight text-white lg:text-2xl" to="/">
          vokter<span className="text-cyan-400">.</span>
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-5 xl:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="nav-link">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2 text-white transition hover:opacity-70"
            aria-label="Buscar"
          >
            <IconSearch />
          </button>
          {isAuthenticated ? (
            <Link to="/account" className="p-2 text-white transition hover:opacity-70" aria-label="Mi cuenta">
              <IconUser />
            </Link>
          ) : (
            <button type="button" onClick={onOpenAuth} className="p-2 text-white transition hover:opacity-70" aria-label="Iniciar sesión">
              <IconUser />
            </button>
          )}
          <button type="button" onClick={openDrawer} className="relative p-2 text-white transition hover:opacity-70" aria-label="Abrir carrito">
            <IconBag />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center bg-white text-[0.6rem] font-bold text-black">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className="flex gap-4 overflow-x-auto border-t border-white/10 px-4 py-2 xl:hidden">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href} className="nav-link shrink-0">
            {link.label}
          </a>
        ))}
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer id="mobile" className="border-t border-neutral-200 bg-white px-4 py-12 text-sm text-neutral-500 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-lg italic text-black">vokter.</p>
          <p className="mt-1">© 2026 Vokter</p>
        </div>
        <p className="max-w-sm text-neutral-600">Intelligent commerce, thoughtfully made.</p>
      </div>
    </footer>
  )
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      className={`scroll-top ${visible ? 'visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
    >
      ↑
    </button>
  )
}

function App() {
  const [authOpen, setAuthOpen] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  const { loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (searchFocus) {
      const timer = setTimeout(() => {
        document.getElementById('hero-search')?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [searchFocus])

  function handleOpenSearch() {
    if (location.pathname !== '/') {
      navigate('/#hero')
    } else {
      document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })
    }
    setSearchFocus(true)
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-white text-black">
      <Header onOpenAuth={() => setAuthOpen(true)} onOpenSearch={handleOpenSearch} />

      <main>
        <Routes>
          <Route path="/" element={<CatalogPage searchFocus={searchFocus} onSearchFocusHandled={() => setSearchFocus(false)} />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/orders/:id" element={<OrderTrackerPage />} />
        </Routes>
      </main>

      <Footer />

      <ScrollToTop />
      <CartDrawer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <div id="ai">
        <AIWidget />
      </div>
    </div>
  )
}

export default App
