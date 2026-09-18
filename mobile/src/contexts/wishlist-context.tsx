import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { api, ApiError } from '../api/client'
import type { Wishlist } from '../api/types'
import { useAuth } from './auth-context'

type WishlistValue = {
  wishlist: Wishlist | null
  loading: boolean
  productIds: Set<number>
  busyProductIds: Set<number>
  toggle: (productId: number) => Promise<void>
}

const WishlistContext = createContext<WishlistValue | null>(null)

export function WishlistProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyProductIds, setBusyProductIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!user) {
      setWishlist(null)
      return
    }
    setLoading(true)
    api.getWishlist()
      .then(setWishlist)
      .catch(() => setWishlist(null))
      .finally(() => setLoading(false))
  }, [user])

  const productIds = useMemo(
    () => new Set(wishlist?.items.map((item) => item.product.id) ?? []),
    [wishlist],
  )

  const toggle = useCallback(async (productId: number) => {
    if (!user) throw new ApiError('Inicia sesión para guardar productos', 401)
    if (busyProductIds.has(productId)) return

    const existingItem = wishlist?.items.find((item) => item.product.id === productId)
    setBusyProductIds((current) => new Set(current).add(productId))
    try {
      const nextWishlist = existingItem
        ? await api.removeWishlistItem(existingItem.id)
        : await api.addWishlistItem(productId)
      setWishlist(nextWishlist)
    } finally {
      setBusyProductIds((current) => {
        const next = new Set(current)
        next.delete(productId)
        return next
      })
    }
  }, [busyProductIds, user, wishlist])

  const value = useMemo(
    () => ({ wishlist, loading, productIds, busyProductIds, toggle }),
    [wishlist, loading, productIds, busyProductIds, toggle],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const value = useContext(WishlistContext)
  if (!value) throw new Error('useWishlist debe usarse dentro de WishlistProvider')
  return value
}
