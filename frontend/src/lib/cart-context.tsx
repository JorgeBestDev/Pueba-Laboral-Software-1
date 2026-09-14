import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from './api'
import type { Cart, CartItem } from './api'
import { useAuth } from './auth-context'

type CartContextValue = {
  cart: Cart | null
  loading: boolean
  error: string | null
  itemCount: number
  isDrawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  addItem: (variantId: number, quantity?: number, unitPrice?: string) => Promise<void>
  updateItem: (itemId: number, quantity: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  reload: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

// Mirrors the total computed by app/api/serializers.py::serialize_cart so the
// optimistic client-side cart looks consistent before the server responds.
function computeTotal(items: CartItem[]): string {
  const total = items.reduce((sum, item) => sum + Number(item.unit_price ?? 0) * item.quantity, 0)
  return total.toFixed(2)
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  // Tracks the latest cart synchronously so optimistic updates never race with
  // the async setCart state batching (e.g. two quick clicks in a row).
  const cartRef = useRef<Cart | null>(null)
  cartRef.current = cart

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
    async (variantId: number, quantity = 1, unitPrice?: string) => {
      setError(null)
      const current = cartRef.current ?? (await api.getCurrentCart())
      const previousCart = current

      // Update the UI immediately (badge count, drawer) instead of waiting for the
      // round trip; the server response reconciles the real ids/prices right after.
      const existing = current.items.find((item) => item.variant_id === variantId)
      const optimisticItems = existing
        ? current.items.map((item) =>
            item.variant_id === variantId ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [
            ...current.items,
            {
              id: -Date.now(),
              variant_id: variantId,
              quantity,
              unit_price: unitPrice ?? null,
            } as CartItem,
          ]
      const optimisticCart: Cart = { ...current, items: optimisticItems, total: computeTotal(optimisticItems) }
      setCart(optimisticCart)
      setDrawerOpen(true)
      // Fire-and-forget analytics event; it must never block cart feedback.
      api
        .recordEvent({ event_type: 'add_to_cart', metadata: { variant_id: variantId, quantity } })
        .catch(() => undefined)

      try {
        const updated = await api.addCartItem(current.id, variantId, quantity)
        setCart(updated)
      } catch (requestError) {
        setCart(previousCart)
        setError(requestError instanceof api.ApiError ? requestError.message : 'No se pudo añadir el producto.')
        throw requestError
      }
    },
    [],
  )

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      const current = cartRef.current
      if (!current) return
      setError(null)
      const previousCart = current
      const optimisticItems = current.items.map((item) => (item.id === itemId ? { ...item, quantity } : item))
      setCart({ ...current, items: optimisticItems, total: computeTotal(optimisticItems) })

      try {
        const updated = await api.updateCartItem(current.id, itemId, quantity)
        setCart(updated)
      } catch (requestError) {
        setCart(previousCart)
        setError(requestError instanceof api.ApiError ? requestError.message : 'No se pudo actualizar el carrito.')
      }
    },
    [],
  )

  const removeItem = useCallback(
    async (itemId: number) => {
      const current = cartRef.current
      if (!current) return
      setError(null)
      const previousCart = current
      const optimisticItems = current.items.filter((item) => item.id !== itemId)
      setCart({ ...current, items: optimisticItems, total: computeTotal(optimisticItems) })

      try {
        const updated = await api.removeCartItem(current.id, itemId)
        setCart(updated)
      } catch (requestError) {
        setCart(previousCart)
        setError(requestError instanceof api.ApiError ? requestError.message : 'No se pudo eliminar el producto.')
      }
    },
    [],
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
