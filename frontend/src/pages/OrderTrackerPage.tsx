import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  cancelOrder,
  getOrder,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type Order,
  type OrderStatus,
} from '../lib/api'
import { useToast } from '../lib/toast-context'
import { Badge, GlassButton, GlassPanel } from '../components/ui'

const TIMELINE: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'completed']

export function OrderTrackerPage() {
  const { id } = useParams<{ id: string }>()
  const { push } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    getOrder(Number(id))
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleCancel() {
    if (!order) return
    setCancelling(true)
    try {
      const updated = await cancelOrder(order.id)
      setOrder(updated)
      push('Pedido cancelado', 'success')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo cancelar el pedido', 'error')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-neutral-500 lg:px-8">Cargando pedido…</div>
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center lg:px-8">
        <GlassPanel className="p-10">
          <p className="text-neutral-600">No pudimos encontrar este pedido.</p>
          <Link to="/account" className="mt-4 inline-block text-xs uppercase tracking-wider underline underline-offset-4 hover:opacity-70">
            ← Volver a mis pedidos
          </Link>
        </GlassPanel>
      </div>
    )
  }

  const isCancelled = order.status === 'cancelled'
  const currentIndex = TIMELINE.indexOf(order.status)
  const canCancel = order.status === 'pending' || order.status === 'paid'

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 lg:px-8">
      <Link to="/account" className="text-xs uppercase tracking-wider text-neutral-500 hover:text-black">
        ← Mis pedidos
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-tight">Pedido #{order.id}</h1>
        <Badge tone={isCancelled ? 'danger' : order.status === 'completed' ? 'success' : 'default'}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>

      {!isCancelled && (
        <GlassPanel className="mt-8 p-6">
          <div className="flex items-center justify-between">
            {TIMELINE.map((status, index) => (
              <div key={status} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center border text-xs font-semibold ${
                    index <= currentIndex ? 'border-black bg-black text-white' : 'border-neutral-300 text-neutral-400'
                  }`}
                >
                  {index + 1}
                </div>
                <p className={`mt-2 text-center text-xs uppercase tracking-wider ${index <= currentIndex ? 'text-black' : 'text-neutral-400'}`}>
                  {ORDER_STATUS_LABEL[status]}
                </p>
              </div>
            ))}
          </div>
          {order.shipment?.tracking_number && (
            <p className="mt-6 text-center text-sm text-neutral-600">
              Guía de envío: <span className="font-medium text-black">{order.shipment.tracking_number}</span> ({order.shipment.carrier ?? 'Transportadora'})
            </p>
          )}
        </GlassPanel>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <GlassPanel className="p-6">
          <h2 className="font-display text-lg uppercase">Artículos</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-neutral-600">
                  {item.product_name} × {item.quantity}
                </span>
                <span className="font-medium">${item.unit_price}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 font-bold">
            <span>Total</span>
            <span>${order.total}</span>
          </div>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="p-6">
            <h2 className="font-display text-lg uppercase">Envío</h2>
            <p className="mt-2 text-sm text-neutral-600">{order.shipping_address ?? 'Dirección no disponible'}</p>
          </GlassPanel>
          {order.payment && (
            <GlassPanel className="p-6">
              <h2 className="font-display text-lg uppercase">Pago</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Método: {PAYMENT_METHOD_LABEL[order.payment.method]} · Estado: <span className="font-medium text-black">{PAYMENT_STATUS_LABEL[order.payment.status]}</span>
              </p>
            </GlassPanel>
          )}
          {canCancel && (
            <GlassButton variant="ghost" onClick={handleCancel} disabled={cancelling} className="w-full justify-center">
              {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  )
}
