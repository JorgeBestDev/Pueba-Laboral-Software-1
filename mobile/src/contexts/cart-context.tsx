import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { api } from '../api/client'
import type { Cart, ProductVariant } from '../api/types'

type CartValue = {
  cart: Cart | null
  loading: boolean
  itemCount: number
  refresh: () => Promise<void>
  add: (variantId: number, optimistic?: OptimisticCartItem) => Promise<void>
  update: (itemId: number, quantity: number) => Promise<void>
  remove: (itemId: number) => Promise<void>
  replaceVariant: (itemId: number, variantId: number) => Promise<void>
}
const CartContext = createContext<CartValue | null>(null)

type OptimisticCartItem = {
  product_name: string
  variant_name: string
  product_slug: string
  image_url: string | null
  unit_price: string
  available_variants: ProductVariant[]
}

function calculateTotal(cart: Cart, items: Cart['items']): Cart {
  const total = items.reduce((sum, item) => sum + (Number(item.unit_price) || 0) * item.quantity, 0)
  return { ...cart, items, total: total.toFixed(2) }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cartRef = useRef<Cart | null>(null)
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mutationVersionRef = useRef(0)
  const itemIdAliasesRef = useRef(new Map<number, number>())
  cartRef.current = cart

  const commitCart = useCallback((nextCart: Cart) => {
    cartRef.current = nextCart
    setCart(nextCart)
  }, [])

  const refresh = useCallback(async () => {
    const current = await api.getCart()
    commitCart(current)
    setError(null)
  }, [commitCart])

  useEffect(() => { refresh().catch(() => setError('No fue posible cargar el carrito.')).finally(() => setLoading(false)) }, [refresh])

  const enqueueMutation = useCallback(
    (
      mutation: () => Promise<Cart>,
      previousCart: Cart,
      version: number,
      fallbackMessage: string,
      rejectOnError = false,
    ) => {
      const task = mutationQueueRef.current.then(async () => {
        try {
          const updated = await mutation()
          if (version === mutationVersionRef.current) commitCart(updated)
        } catch (requestError) {
          if (version === mutationVersionRef.current) {
            try {
              const reconciled = await api.getCart()
              if (version === mutationVersionRef.current) commitCart(reconciled)
            } catch {
              commitCart(previousCart)
            }
            setError(requestError instanceof Error ? requestError.message : fallbackMessage)
          }
          if (rejectOnError) throw requestError
        }
      })
      mutationQueueRef.current = task.catch(() => undefined)
      return task
    },
    [commitCart],
  )

  const add = useCallback(async (variantId: number, optimistic?: OptimisticCartItem) => {
    let active = cartRef.current
    if (!active) {
      active = await api.getCart()
      commitCart(active)
    }

    const previousCart = active
    const version = ++mutationVersionRef.current
    const existing = active.items.find((item) => item.variant_id === variantId)
    const temporaryItemId = -Date.now() - Math.floor(Math.random() * 1000)
    const pendingItemIds = active.items
      .filter((item) => item.variant_id === variantId && item.id < 0)
      .map((item) => item.id)
    const optimisticItems = existing
      ? active.items.map((item) => item.variant_id === variantId ? { ...item, quantity: item.quantity + 1 } : item)
      : [
          ...active.items,
          {
            id: temporaryItemId,
            variant_id: variantId,
            product_name: optimistic?.product_name ?? 'Producto',
            variant_name: optimistic?.variant_name ?? `Variante #${variantId}`,
            product_slug: optimistic?.product_slug ?? '',
            image_url: optimistic?.image_url ?? null,
            available_variants: optimistic?.available_variants ?? [],
            quantity: 1,
            unit_price: optimistic?.unit_price ?? '0.00',
          },
        ]
    commitCart(calculateTotal(active, optimisticItems))

    return enqueueMutation(
      async () => {
        const updated = await api.addCartItem(active.id, variantId)
        const serverItem = updated.items.find((item) => item.variant_id === variantId)
        if (serverItem) {
          const optimisticIds = existing ? pendingItemIds : [...pendingItemIds, temporaryItemId]
          optimisticIds.forEach((id) => itemIdAliasesRef.current.set(id, serverItem.id))
        }
        return updated
      },
      previousCart,
      version,
      'No fue posible añadir el producto.',
      true,
    )
  }, [commitCart, enqueueMutation])

  const update = useCallback(async (itemId: number, quantity: number) => {
    const active = cartRef.current
    if (!active) return
    const item = active.items.find((candidate) => candidate.id === itemId)
    if (!item) return
    const previousCart = active
    const version = ++mutationVersionRef.current
    const optimisticItems = active.items.map((candidate) => candidate.id === itemId ? { ...candidate, quantity } : candidate)
    commitCart(calculateTotal(active, optimisticItems))
    await enqueueMutation(
      () => api.updateCartItem(active.id, itemIdAliasesRef.current.get(itemId) ?? itemId, quantity),
      previousCart,
      version,
      'No fue posible actualizar el carrito.',
    )
  }, [commitCart, enqueueMutation])

  const remove = useCallback(async (itemId: number) => {
    const active = cartRef.current
    if (!active) return
    const item = active.items.find((candidate) => candidate.id === itemId)
    if (!item) return
    const previousCart = active
    const version = ++mutationVersionRef.current
    const optimisticItems = active.items.filter((candidate) => candidate.id !== itemId)
    commitCart(calculateTotal(active, optimisticItems))
    await enqueueMutation(
      () => api.removeCartItem(active.id, itemIdAliasesRef.current.get(itemId) ?? itemId),
      previousCart,
      version,
      'No fue posible eliminar el producto.',
    )
  }, [commitCart, enqueueMutation])

  const replaceVariant = useCallback(async (itemId: number, variantId: number) => {
    const active = cartRef.current
    if (!active) return
    const previousCart = active
    const version = ++mutationVersionRef.current
    const optimisticItems = active.items.map((item) => item.id === itemId ? { ...item, variant_id: variantId } : item)
    commitCart(calculateTotal(active, optimisticItems))
    await enqueueMutation(
      () => api.replaceCartItemVariant(active.id, itemIdAliasesRef.current.get(itemId) ?? itemId, variantId),
      previousCart,
      version,
      'No fue posible cambiar la variante.',
    )
  }, [commitCart, enqueueMutation])

  const value = useMemo(() => ({
    cart,
    loading,
    error,
    itemCount: cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
    refresh,
    add,
    update,
    remove,
    replaceVariant,
  }), [cart, loading, error, refresh, add, update, remove, replaceVariant])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart debe usarse dentro de CartProvider')
  return value
}
