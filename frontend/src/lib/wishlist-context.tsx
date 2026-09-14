import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from './api'
import type { Wishlist } from './api'
import { useAuth } from './auth-context'

type WishlistContextValue = {
  wishlist: Wishlist | null
  loading: boolean
  productIds: Set<number>
  toggle: (productId: number) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlist(null)
      return
    }
    setLoading(true)
    api
      .getWishlist()
      .then(setWishlist)
      .catch(() => setWishlist(null))
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const productIds = useMemo(() => new Set(wishlist?.items.map((item) => item.product.id) ?? []), [wishlist])

  const toggle = useCallback(
    async (productId: number) => {
      if (!isAuthenticated) throw new api.ApiError('Inicia sesión para guardar productos', 401, 'authentication_required')
      const existingItem = wishlist?.items.find((item) => item.product.id === productId)
      if (existingItem) {
        setWishlist(await api.removeWishlistItem(existingItem.id))
      } else {
        setWishlist(await api.addWishlistItem(productId))
      }
    },
    [isAuthenticated, wishlist],
  )

  const value = useMemo<WishlistContextValue>(
    () => ({ wishlist, loading, productIds, toggle }),
    [wishlist, loading, productIds, toggle],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext)
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider')
  return context
}
