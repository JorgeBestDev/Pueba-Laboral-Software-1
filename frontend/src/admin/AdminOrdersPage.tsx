import { useEffect, useState } from 'react'
import * as adminApi from '../lib/admin-api'
import { Modal } from '../components/ui'
import { AdminBadge, AdminEmptyState, AdminPagination, statusTone } from './AdminUI'

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'paid', label: 'Pagado' },
  { value: 'processing', label: 'Procesando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'authorized', label: 'Autorizado' },
  { value: 'paid', label: 'Pagado' },
  { value: 'failed', label: 'Fallido' },
  { value: 'refunded', label: 'Reembolsado' },
]

const SHIPMENT_STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'returned', label: 'Devuelto' },
]

function formatCurrency(value: string | number | null) {
  const amount = typeof value === 'string' ? Number(value) : value ?? 0
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function statusLabel(list: { value: string; label: string }[], value: string) {
  return list.find((item) => item.value === value)?.label ?? value
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<adminApi.AdminOrder[]>([])
  const [meta, setMeta] = useState<{ page: number; pages: number } | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<adminApi.AdminOrder | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi
      .listAdminOrders({ page, status: status || undefined, q: search || undefined })
      .then((response) => {
        setOrders(response.data)
        setMeta({ page: response.meta.page, pages: response.meta.pages })
        setError(null)
      })
      .catch((err) => setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudieron cargar los pedidos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status])

  const openDetail = (order: adminApi.AdminOrder) => {
    // Open immediately with the data we already have from the list — the user
    // sees the modal at once.  Then fetch the full detail in the background to
    // populate status_history and any fields the list omits.
    setSelected(order)
    setModalLoading(true)
    adminApi.getAdminOrder(order.id)
      .then((full) => setSelected(full))
      .catch(() => { /* keep the partial data already shown */ })
      .finally(() => setModalLoading(false))
  }

  const refreshSelected = async () => {
    if (!selected) return
    const order = await adminApi.getAdminOrder(selected.id)
    setSelected(order)
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)))
  }

  const handleStatusChange = async (value: string) => {
    if (!selected) return
    // Optimistically update the select so it feels instant
    setSelected((prev) => prev ? { ...prev, status: value as adminApi.AdminOrder['status'] } : prev)
    setSaving(true)
    try {
      await adminApi.updateAdminOrderStatus(selected.id, value)
      await refreshSelected()
    } catch (err) {
      await refreshSelected() // revert to server state
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo actualizar el estado')
    } finally {
      setSaving(false)
    }
  }

  const handlePaymentChange = async (value: string) => {
    if (!selected) return
    setSaving(true)
    try {
      await adminApi.updateAdminOrderPayment(selected.id, value)
      await refreshSelected()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo actualizar el pago')
    } finally {
      setSaving(false)
    }
  }

  const handleShipmentChange = async (value: string) => {
    if (!selected) return
    setSaving(true)
    try {
      await adminApi.updateAdminOrderShipment(selected.id, { status: value })
      await refreshSelected()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo actualizar el envío')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1)
              load()
            }
          }}
          placeholder="Buscar por cliente o correo…"
          className="glass-input sm:max-w-xs"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className="glass-input sm:max-w-[200px]"
        >
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setPage(1)
            load()
          }}
          className="glass-button !bg-black !text-white"
        >
          Buscar
        </button>
      </div>

      {error && <p className="border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="animate-pulse space-y-0 divide-y divide-neutral-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-4 w-10 rounded bg-neutral-100" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-32 rounded bg-neutral-100" />
                  <div className="h-2 w-24 rounded bg-neutral-100" />
                </div>
                <div className="h-5 w-20 rounded bg-neutral-100" />
                <div className="h-3 w-16 rounded bg-neutral-100" />
                <div className="h-3 w-24 rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <AdminEmptyState message="No se encontraron pedidos con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium">#{order.id}</td>
                    <td className="px-4 py-3">
                      {order.customer?.name}
                      <span className="block text-xs text-neutral-500">{order.customer?.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge tone={statusTone(order.status)}>{statusLabel(ORDER_STATUSES, order.status)}</AdminBadge>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3 text-neutral-500">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(order)}
                        className="text-xs font-semibold uppercase tracking-widest underline underline-offset-4"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && <AdminPagination page={meta.page} pages={meta.pages} onChange={setPage} />}
      </div>

      <Modal open={selected !== null} onClose={() => setSelected(null)} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">
                Pedido #{selected.id}
                {modalLoading && (
                  <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-black align-middle" />
                )}
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black"
                aria-label="Cerrar"
              >
                Cerrar ✕
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold">{selected.customer?.name}</p>
              <p className="text-xs text-neutral-500">{selected.customer?.email}</p>
              {selected.shipping_address && <p className="mt-1 text-xs text-neutral-500">{selected.shipping_address}</p>}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Estado</label>
                <select
                  value={selected.status}
                  disabled={saving}
                  onChange={(event) => handleStatusChange(event.target.value)}
                  className="glass-input"
                >
                  {ORDER_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Pago</label>
                <select
                  value={selected.payment?.status ?? ''}
                  disabled={saving}
                  onChange={(event) => handlePaymentChange(event.target.value)}
                  className="glass-input"
                >
                  <option value="" disabled>
                    Sin pago
                  </option>
                  {PAYMENT_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Envío</label>
                <select
                  value={selected.shipment?.status ?? ''}
                  disabled={saving}
                  onChange={(event) => handleShipmentChange(event.target.value)}
                  className="glass-input"
                >
                  <option value="" disabled>
                    Sin envío
                  </option>
                  {SHIPMENT_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Artículos</p>
              <ul className="divide-y divide-neutral-100 border border-neutral-200">
                {selected.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {item.product_name} <span className="text-neutral-400">× {item.quantity}</span>
                    </span>
                    <span className="font-medium">{formatCurrency(item.unit_price)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end text-sm font-semibold">Total: {formatCurrency(selected.total)}</div>
            </div>

            {selected.status_history.length > 0 && (
              <div>
                <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Historial</p>
                <ul className="space-y-1 text-xs text-neutral-500">
                  {selected.status_history.map((entry, index) => (
                    <li key={index}>
                      {formatDate(entry.created_at)} — {statusLabel(ORDER_STATUSES, entry.status)}
                      {entry.note ? ` (${entry.note})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
