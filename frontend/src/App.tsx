import { useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { AIWidget } from './components/AIWidget'
import { AuthModal } from './components/AuthModal'
import { CartDrawer } from './components/CartDrawer'
import { GlassButton } from './components/ui'
import { useAuth } from './lib/auth-context'
import { useCart } from './lib/cart-context'
import { AccountPage } from './pages/AccountPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderTrackerPage } from './pages/OrderTrackerPage'
import { ProductDetailPage } from './pages/ProductDetailPage'

function Header({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user, isAuthenticated } = useAuth()
  const { itemCount, openDrawer } = useCart()

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link className="text-2xl font-black tracking-tight" to="/">
          vokter<span className="text-cyan-300">.</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <Link className="hover:text-cyan-200" to="/#catalog">
            Explore
          </Link>
          <a href="#" className="hover:text-cyan-200">
            AI concierge
          </a>
          <a href="#mobile" className="hover:text-cyan-200">
            Mobile app
          </a>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link to="/account">
              <GlassButton variant="ghost" className="hidden sm:inline-flex">
                {user?.first_name || 'Mi cuenta'}
              </GlassButton>
            </Link>
          ) : (
            <GlassButton variant="ghost" className="hidden sm:inline-flex" onClick={onOpenAuth}>
              Sign in
            </GlassButton>
          )}
          <GlassButton variant="icon" className="rounded-full px-4" onClick={openDrawer} aria-label="Abrir carrito">
            Cart <span className="ml-1 text-cyan-300">({itemCount})</span>
          </GlassButton>
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer id="mobile" className="relative z-10 border-t border-white/10 bg-slate-950/50 px-5 py-10 text-sm text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row">
        <span>© 2026 Vokter</span>
        <span>Intelligent commerce, thoughtfully made.</span>
      </div>
    </footer>
  )
}

function App() {
  const [authOpen, setAuthOpen] = useState(false)
  const { loading } = useAuth()

  if (loading) return null

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="blob blob-cyan" />
        <div className="blob blob-violet" />
        <div className="blob blob-pink" />
      </div>

      <Header onOpenAuth={() => setAuthOpen(true)} />

      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/orders/:id" element={<OrderTrackerPage />} />
        </Routes>
      </main>

      <Footer />

      <CartDrawer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AIWidget />
    </div>
  )
}

export default App

