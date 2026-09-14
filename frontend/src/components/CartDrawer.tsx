import { Link } from 'react-router-dom'
import { useCart } from '../lib/cart-context'
import { GlassButton, Drawer } from './ui'

export function CartDrawer() {
  const { cart, isDrawerOpen, closeDrawer, updateItem, removeItem, error } = useCart()
  const items = cart?.items ?? []

  return (
    <Drawer open={isDrawerOpen} onClose={closeDrawer} title="Tu carrito">
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-neutral-500">
          <p>Tu carrito está vacío.</p>
          <GlassButton variant="ghost" onClick={closeDrawer}>
            Seguir explorando
          </GlassButton>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border border-neutral-200 p-4">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wide">Variante #{item.variant_id}</p>
                <p className="mt-1 text-xs text-neutral-500">${item.unit_price} c/u</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center border border-neutral-300 text-sm hover:border-black"
                    onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                    aria-label="Disminuir cantidad"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center border border-neutral-300 text-sm hover:border-black"
                    onClick={() => updateItem(item.id, item.quantity + 1)}
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-bold">
                  ${item.unit_price ? (Number(item.unit_price) * item.quantity).toFixed(2) : '0.00'}
                </p>
                <button type="button" onClick={() => removeItem(item.id)} className="text-xs uppercase tracking-wider text-neutral-500 underline underline-offset-2 hover:text-black">
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Subtotal</span>
            <span>${cart?.total}</span>
          </div>
          <Link to="/checkout" onClick={closeDrawer}>
            <GlassButton className="mt-4 w-full justify-center">Ir a pagar</GlassButton>
          </Link>
        </div>
      )}
    </Drawer>
  )
}
