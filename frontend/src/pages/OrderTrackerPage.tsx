import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, cancelOrder, getOrder, type Order, type OrderStatus } from '../lib/api'
import { useToast } from '../lib/toast-context'
import { Badge, GlassButton, GlassPanel } from '../components/ui'

const TIMELINE: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'completed']

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  processing: 'En preparación',
  shipped: 'Enviado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

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
    return <div className="mx-auto max-w-3xl px-5 py-24 text-center text-slate-400 lg:px-8">Cargando pedido…</div>
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center lg:px-8">
        <GlassPanel className="p-10">
          <p className="text-slate-300">No pudimos encontrar este pedido.</p>
          <Link to="/account" className="mt-4 inline-block text-cyan-300 hover:text-cyan-100">
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
    <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
      <Link to="/account" className="text-sm text-slate-500 hover:text-cyan-200">
        ← Mis pedidos
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Pedido #{order.id}</h1>
        <Badge tone={isCancelled ? 'danger' : order.status === 'completed' ? 'success' : 'default'}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      {!isCancelled && (
        <GlassPanel className="mt-8 p-6">
          <div className="flex items-center justify-between">
            {TIMELINE.map((status, index) => (
              <div key={status} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${
                    index <= currentIndex ? 'border-cyan-300/50 bg-cyan-300/20 text-cyan-100' : 'border-white/10 text-slate-500'
                  }`}
                >
                  {index + 1}
                </div>
                <p className={`mt-2 text-center text-xs ${index <= currentIndex ? 'text-slate-200' : 'text-slate-500'}`}>{STATUS_LABEL[status]}</p>
                {index < TIMELINE.length - 1 && (
                  <div className={`mt-[-1.4rem] h-px w-full translate-y-[-1rem] ${index < currentIndex ? 'bg-cyan-300/50' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
          {order.shipment?.tracking_number && (
            <p className="mt-6 text-center text-sm text-slate-400">
              Guía de envío: <span className="text-cyan-200">{order.shipment.tracking_number}</span> ({order.shipment.carrier ?? 'Transportadora'})
            </p>
          )}
        </GlassPanel>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <GlassPanel className="p-6">
          <h2 className="text-lg font-semibold">Artículos</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm text-slate-300">
                <span>
                  {item.product_name} × {item.quantity}
                </span>
                <span>${item.unit_price}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-semibold">
            <span>Total</span>
            <span className="text-cyan-100">${order.total}</span>
          </div>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="p-6">
            <h2 className="text-lg font-semibold">Envío</h2>
            <p className="mt-2 text-sm text-slate-400">{order.shipping_address ?? 'Dirección no disponible'}</p>
          </GlassPanel>
          {order.payment && (
            <GlassPanel className="p-6">
              <h2 className="text-lg font-semibold">Pago</h2>
              <p className="mt-2 text-sm text-slate-400">
                Método: {order.payment.method} · Estado: <span className="text-cyan-200">{order.payment.status}</span>
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
