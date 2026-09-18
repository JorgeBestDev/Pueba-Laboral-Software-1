import { Link } from 'react-router-dom'
import { useCart } from '../lib/cart-context'
import { resolveMediaUrl } from '../lib/api'
import { GlassButton, Drawer } from './ui'

export function CartDrawer() {
  const { cart, isDrawerOpen, closeDrawer, updateItem, replaceItemVariant, removeItem, error } = useCart()
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
            <li key={item.id} className="flex items-start justify-between gap-3 border border-neutral-200 p-4">
              {item.image_url ? (
                <img className="h-20 w-16 shrink-0 object-cover product-image-bg" src={resolveMediaUrl(item.image_url)} alt={item.product_name ?? ''} />
              ) : (
                <div className="h-20 w-16 shrink-0 product-image-bg" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.product_name ?? 'Producto'}</p>
                {item.available_variants && item.available_variants.length > 1 ? (
                  <label className="mt-1 block">
                    <span className="sr-only">Variante de {item.product_name ?? 'producto'}</span>
                    <span className="relative mt-1 block">
                      <select
                        value={item.variant_id}
                        onChange={(event) => void replaceItemVariant(item.id, Number(event.target.value))}
                        className="glass-input w-full appearance-none !px-2 !py-2 !pr-8 text-[0.65rem] font-semibold uppercase tracking-wider"
                      >
                        {item.available_variants.map((variant) => (
                          <option key={variant.id} value={variant.id} disabled={variant.stock_quantity < 1}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-neutral-500" aria-hidden="true">
                        ▾
                      </span>
                    </span>
                  </label>
                ) : (
                  <p className="mt-1 text-xs text-neutral-500">{item.variant_name ?? 'Variante única'}</p>
                )}
                <p className="mt-1 text-xs text-neutral-500">${item.unit_price ?? '0.00'} c/u</p>
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
