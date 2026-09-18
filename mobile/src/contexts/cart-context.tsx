import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { api } from '../api/client'
import type { Cart } from '../api/types'

type CartValue = {
  cart: Cart | null
  loading: boolean
  itemCount: number
  refresh: () => Promise<void>
  add: (variantId: number) => Promise<void>
  update: (itemId: number, quantity: number) => Promise<void>
  remove: (itemId: number) => Promise<void>
  replaceVariant: (itemId: number, variantId: number) => Promise<void>
}
const CartContext = createContext<CartValue | null>(null)

export function CartProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => setCart(await api.getCart()), [])
  useEffect(() => { refresh().catch(() => undefined).finally(() => setLoading(false)) }, [refresh])
  const add = useCallback(async (variantId: number) => { const active = cart ?? await api.getCart(); setCart(await api.addCartItem(active.id, variantId)) }, [cart])
  const update = useCallback(async (itemId: number, quantity: number) => { if (cart) setCart(await api.updateCartItem(cart.id, itemId, quantity)) }, [cart])
  const remove = useCallback(async (itemId: number) => { if (cart) setCart(await api.removeCartItem(cart.id, itemId)) }, [cart])
  const replaceVariant = useCallback(async (itemId: number, variantId: number) => { if (cart) setCart(await api.replaceCartItemVariant(cart.id, itemId, variantId)) }, [cart])
  const value = useMemo(() => ({ cart, loading, itemCount: cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0, refresh, add, update, remove, replaceVariant }), [cart, loading, refresh, add, update, remove, replaceVariant])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart debe usarse dentro de CartProvider')
  return value
}
