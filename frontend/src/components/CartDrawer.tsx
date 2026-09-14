import { Link } from 'react-router-dom'
import { useCart } from '../lib/cart-context'
import { GlassButton, Drawer } from './ui'

export function CartDrawer() {
  const { cart, isDrawerOpen, closeDrawer, updateItem, removeItem, error } = useCart()
  const items = cart?.items ?? []

  return (
    <Drawer open={isDrawerOpen} onClose={closeDrawer} title="Tu carrito">
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
          <p>Tu carrito está vacío.</p>
          <GlassButton variant="ghost" onClick={closeDrawer}>
            Seguir explorando
          </GlassButton>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-100">Variante #{item.variant_id}</p>
                <p className="text-xs text-slate-400">${item.unit_price} c/u</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="glass-button h-7 w-7 justify-center border border-white/10 bg-white/5 p-0 text-sm"
                    onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                    aria-label="Disminuir cantidad"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    className="glass-button h-7 w-7 justify-center border border-white/10 bg-white/5 p-0 text-sm"
                    onClick={() => updateItem(item.id, item.quantity + 1)}
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-semibold text-cyan-100">
                  ${item.unit_price ? (Number(item.unit_price) * item.quantity).toFixed(2) : '0.00'}
                </p>
                <button onClick={() => removeItem(item.id)} className="text-xs text-slate-500 hover:text-rose-300">
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="flex justify-between text-lg font-semibold">
            <span>Subtotal</span>
            <span className="text-cyan-100">${cart?.total}</span>
          </div>
          <Link to="/checkout" onClick={closeDrawer}>
            <GlassButton className="mt-4 w-full justify-center">Ir a pagar</GlassButton>
          </Link>
        </div>
      )}
    </Drawer>
  )
}
