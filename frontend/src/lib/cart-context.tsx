import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from './api'
import type { Cart } from './api'
import { useAuth } from './auth-context'

type CartContextValue = {
  cart: Cart | null
  loading: boolean
  error: string | null
  itemCount: number
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  addItem: (variantId: number, quantity?: number) => Promise<void>
  updateItem: (itemId: number, quantity: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  reload: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // Resolving the cart is the single owner of "merge anonymous cart into user cart"
      // so it never races with another call trying to create the user's cart at the same time.
      const current = api.getStoredTokens()?.access_token ? await api.mergeCart() : await api.getCurrentCart()
      setCart(current)
      setError(null)
    } catch {
      setError('No se pudo cargar el carrito.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    // Re-fetch whenever auth state flips, so an anonymous cart becomes the user's cart after merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const addItem = useCallback(
    async (variantId: number, quantity = 1) => {
      setError(null)
      try {
        const current = cart ?? (await api.getCurrentCart())
        const updated = await api.addCartItem(current.id, variantId, quantity)
        setCart(updated)
        setDrawerOpen(true)
        await api.recordEvent({ event_type: 'add_to_cart', metadata: { variant_id: variantId, quantity } })
      } catch (requestError) {
        setError(requestError instanceof api.ApiError ? requestError.message : 'No se pudo añadir el producto.')
        throw requestError
      }
    },
    [cart],
  )

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      if (!cart) return
      setError(null)
      try {
        const updated = await api.updateCartItem(cart.id, itemId, quantity)
        setCart(updated)
      } catch (requestError) {
        setError(requestError instanceof api.ApiError ? requestError.message : 'No se pudo actualizar el carrito.')
      }
    },
    [cart],
  )

  const removeItem = useCallback(
    async (itemId: number) => {
      if (!cart) return
      setError(null)
      try {
        const updated = await api.removeCartItem(cart.id, itemId)
        setCart(updated)
      } catch (requestError) {
        setError(requestError instanceof api.ApiError ? requestError.message : 'No se pudo eliminar el producto.')
      }
    },
    [cart],
  )

  const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cart])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      error,
      itemCount,
      isDrawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      addItem,
      updateItem,
      removeItem,
      reload,
    }),
    [cart, loading, error, itemCount, isDrawerOpen, addItem, updateItem, removeItem, reload],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within a CartProvider')
  return context
}
