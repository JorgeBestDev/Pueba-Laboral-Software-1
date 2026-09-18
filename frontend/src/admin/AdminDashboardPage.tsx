import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminApi from '../lib/admin-api'
import { AdminBadge, AdminEmptyState, KpiCard, statusTone } from './AdminUI'

function formatCurrency(value: string | number) {
  const amount = typeof value === 'string' ? Number(value) : value
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<adminApi.DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    adminApi
      .getDashboardSummary()
      .then((data) => active && setSummary(data))
      .catch((err) => active && setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo cargar el dashboard'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  if (error) return <AdminEmptyState message={error} />

  // Show skeleton cards while the single dashboard request is in-flight.
  // This avoids a completely blank page — the user sees the layout immediately.
  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel h-24 bg-neutral-100 p-5" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel h-48 bg-neutral-100 p-5 lg:col-span-1" />
        <div className="glass-panel h-48 bg-neutral-100 p-5 lg:col-span-2" />
      </div>
      <div className="glass-panel h-64 bg-neutral-100 p-5" />
    </div>
  )

  if (!summary) return <AdminEmptyState message="No hay datos disponibles" />

  const { kpis, orders_by_status, low_stock_alerts, recent_orders } = summary

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pedidos activos" value={kpis.active_orders} hint={`${kpis.total_orders} pedidos totales`} />
        <KpiCard label="Ventas del mes" value={formatCurrency(kpis.sales_month_total)} tone="success" />
        <KpiCard label="Ventas históricas" value={formatCurrency(kpis.sales_all_time_total)} />
        <KpiCard
          label="Calificación promedio"
          value={kpis.average_rating ? kpis.average_rating.toFixed(1) : '—'}
          hint={`${kpis.customers_count} clientes · ${kpis.products_count} productos`}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel p-5 lg:col-span-1">
          <h2 className="font-display mb-4 text-sm uppercase tracking-widest text-neutral-500">Pedidos por estado</h2>
          <div className="space-y-3">
            {orders_by_status.map((entry) => (
              <div key={entry.status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-black">{entry.label}</span>
                  <span className="text-neutral-500">
                    {entry.count} · {entry.percentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden bg-neutral-100">
                  <div className="h-full bg-black" style={{ width: `${entry.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-5 lg:col-span-2">
          <h2 className="font-display mb-4 text-sm uppercase tracking-widest text-neutral-500">Alertas de stock bajo</h2>
          {low_stock_alerts.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay variantes con stock crítico.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                    <th className="pb-2 pr-4 font-medium">Producto</th>
                    <th className="pb-2 pr-4 font-medium">SKU</th>
                    <th className="pb-2 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {low_stock_alerts.map((alert) => (
                    <tr key={alert.variant_id} className="border-b border-neutral-100 last:border-0">
                      <td className="py-2 pr-4">
                        {alert.product_name}
                        <span className="block text-xs text-neutral-500">{alert.variant_name}</span>
                      </td>
                      <td className="py-2 pr-4 text-neutral-500">{alert.sku}</td>
                      <td className="py-2">
                        <AdminBadge tone={alert.stock_quantity === 0 ? 'danger' : 'warning'}>
                          {alert.stock_quantity} / {alert.threshold}
                        </AdminBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm uppercase tracking-widest text-neutral-500">Pedidos recientes</h2>
          <Link to="/admin/pedidos" className="text-xs font-semibold uppercase tracking-widest text-black underline underline-offset-4">
            Ver todos
          </Link>
        </div>
        {recent_orders.length === 0 ? (
          <p className="text-sm text-neutral-500">Aún no hay pedidos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                  <th className="pb-2 pr-4 font-medium">Pedido</th>
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recent_orders.map((order) => (
                  <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 pr-4">
                      <Link to="/admin/pedidos" className="font-medium text-black hover:underline">
                        #{order.id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {order.customer_name}
                      <span className="block text-xs text-neutral-500">{order.customer_email}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <AdminBadge tone={statusTone(order.status)}>{order.status_label}</AdminBadge>
                    </td>
                    <td className="py-2 pr-4">{formatCurrency(order.total)}</td>
                    <td className="py-2 text-neutral-500">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
