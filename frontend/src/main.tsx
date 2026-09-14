import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AdminAuthProvider } from './lib/admin-auth-context'
import { AuthProvider } from './lib/auth-context'
import { CartProvider } from './lib/cart-context'
import { WishlistProvider } from './lib/wishlist-context'
import { ToastProvider } from './lib/toast-context'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <AdminAuthProvider>
                <App />
              </AdminAuthProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
