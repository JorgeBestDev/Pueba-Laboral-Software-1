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
  replaceItemVariant: (itemId: number, variantId: number) => Promise<void>
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
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mutationVersionRef = useRef(0)
  const itemIdAliasesRef = useRef(new Map<number, number>())
  cartRef.current = cart

  const commitCart = useCallback((nextCart: Cart) => {
    cartRef.current = nextCart
    setCart(nextCart)
  }, [])

  const enqueueMutation = useCallback(
    (
      mutation: () => Promise<Cart>,
      previousCart: Cart,
      version: number,
      fallbackMessage: string,
    ) => {
      mutationQueueRef.current = mutationQueueRef.current
        .then(async () => {
          const updated = await mutation()
          // Only the response for the newest local mutation may replace the
          // optimistic state. Older responses are still useful for resolving
          // temporary item IDs, but would otherwise make the UI jump backwards.
          if (version === mutationVersionRef.current) commitCart(updated)
        })
        .catch(async (requestError) => {
          if (version === mutationVersionRef.current) {
            try {
              const reconciled = await api.getCurrentCart()
              if (version === mutationVersionRef.current) commitCart(reconciled)
            } catch {
              commitCart(previousCart)
            }
          }
          if (version === mutationVersionRef.current) {
            setError(requestError instanceof api.ApiError ? requestError.message : fallbackMessage)
          }
        })
    },
    [commitCart],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // Resolving the cart is the single owner of "merge anonymous cart into user cart"
      // so it never races with another call trying to create the user's cart at the same time.
      const current = api.getStoredTokens()?.access_token ? await api.mergeCart() : await api.getCurrentCart()
      commitCart(current)
      setError(null)
    } catch {
      setError('No se pudo cargar el carrito.')
    } finally {
      setLoading(false)
    }
  }, [commitCart])

  useEffect(() => {
    reload()
    // Re-fetch whenever auth state flips, so an anonymous cart becomes the user's cart after merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const addItem = useCallback(
    async (variantId: number, quantity = 1, unitPrice?: string) => {
      setError(null)
      // cartRef is synchronously up-to-date thanks to `cartRef.current = cart`
      // at the top of the provider.  If it's still null (mount hasn't finished)
      // we wait for the in-flight reload() instead of creating a second fetch.
      let current = cartRef.current
      if (!current) {
        await reload()
        current = cartRef.current
      }
      if (!current) return   // reload failed, error already set by reload()
      const previousCart = current
      const version = ++mutationVersionRef.current

      // Update the UI immediately (badge count, drawer) instead of waiting for the
      // round trip; the server response reconciles the real ids/prices right after.
      const existing = current.items.find((item) => item.variant_id === variantId)
      const pendingItemIds = current.items
        .filter((item) => item.variant_id === variantId && item.id < 0)
        .map((item) => item.id)
      const temporaryItemId = -Date.now() - Math.floor(Math.random() * 1000)
      const optimisticItems = existing
        ? current.items.map((item) =>
            item.variant_id === variantId ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [
            ...current.items,
            {
              id: temporaryItemId,
              variant_id: variantId,
              quantity,
              unit_price: unitPrice ?? null,
            } as CartItem,
          ]
      const optimisticCart: Cart = { ...current, items: optimisticItems, total: computeTotal(optimisticItems) }
      commitCart(optimisticCart)
      setDrawerOpen(true)
      // Fire-and-forget analytics event; it must never block cart feedback.
      api
        .recordEvent({ event_type: 'add_to_cart', metadata: { variant_id: variantId, quantity } })
        .catch(() => undefined)

      enqueueMutation(
        async () => {
          const updated = await api.addCartItem(current.id, variantId, quantity)
          const serverItem = updated.items.find((item) => item.variant_id === variantId)
          if (serverItem) {
            const optimisticItemIds = existing ? pendingItemIds : [...pendingItemIds, temporaryItemId]
            optimisticItemIds.forEach((optimisticItemId) => itemIdAliasesRef.current.set(optimisticItemId, serverItem.id))
          }
          return updated
        },
        previousCart,
        version,
        'No se pudo añadir el producto.',
      )
    },
    [commitCart, enqueueMutation, reload],
  )

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      const current = cartRef.current
      if (!current) return
      setError(null)
      const previousCart = current
      const item = current.items.find((candidate) => candidate.id === itemId)
      if (!item) return
      const version = ++mutationVersionRef.current
      const optimisticItems = current.items.map((item) => (item.id === itemId ? { ...item, quantity } : item))
      commitCart({ ...current, items: optimisticItems, total: computeTotal(optimisticItems) })

      enqueueMutation(
        async () => {
          const resolvedItemId = itemIdAliasesRef.current.get(itemId) ?? itemId
          return api.updateCartItem(current.id, resolvedItemId, quantity)
        },
        previousCart,
        version,
        'No se pudo actualizar el carrito.',
      )
    },
    [commitCart, enqueueMutation],
  )

  const removeItem = useCallback(
    async (itemId: number) => {
      const current = cartRef.current
      if (!current) return
      setError(null)
      const previousCart = current
      const item = current.items.find((candidate) => candidate.id === itemId)
      if (!item) return
      const version = ++mutationVersionRef.current
      const optimisticItems = current.items.filter((item) => item.id !== itemId)
      commitCart({ ...current, items: optimisticItems, total: computeTotal(optimisticItems) })

      enqueueMutation(
        async () => {
          const resolvedItemId = itemIdAliasesRef.current.get(itemId) ?? itemId
          return api.removeCartItem(current.id, resolvedItemId)
        },
        previousCart,
        version,
        'No se pudo eliminar el producto.',
      )
    },
    [commitCart, enqueueMutation],
  )

  const replaceItemVariant = useCallback(
    async (itemId: number, variantId: number) => {
      const current = cartRef.current
      if (!current) return
      setError(null)
      const previousCart = current
      const item = current.items.find((candidate) => candidate.id === itemId)
      const selectedVariant = item?.available_variants?.find((variant) => variant.id === variantId)
      if (!item || !selectedVariant || item.variant_id === variantId) return
      const version = ++mutationVersionRef.current
      const optimisticItems = current.items.map((candidate) =>
        candidate.id === itemId
          ? {
              ...candidate,
              variant_id: variantId,
              variant_name: selectedVariant.name,
              unit_price: selectedVariant.price,
            }
          : candidate,
      )
      commitCart({ ...current, items: optimisticItems, total: computeTotal(optimisticItems) })

      enqueueMutation(
        async () => {
          const resolvedItemId = itemIdAliasesRef.current.get(itemId) ?? itemId
          return api.replaceCartItemVariant(current.id, resolvedItemId, variantId)
        },
        previousCart,
        version,
        'No se pudo cambiar la variante.',
      )
    },
    [commitCart, enqueueMutation],
  )

  // Keep the header usable even if a proxy or an interrupted request returns
  // an incomplete cart payload. Normal API responses always include items.
  const itemCount = useMemo(
    () => (Array.isArray(cart?.items) ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0),
    [cart],
  )

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
      replaceItemVariant,
      removeItem,
      reload,
    }),
    [cart, loading, error, itemCount, isDrawerOpen, addItem, updateItem, replaceItemVariant, removeItem, reload],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within a CartProvider')
  return context
}
