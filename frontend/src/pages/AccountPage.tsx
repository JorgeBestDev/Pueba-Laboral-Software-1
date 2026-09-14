import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ApiError,
  deleteAddress,
  listAddresses,
  listOrders,
  removeWishlistItem,
  updateAddress,
  type Address,
  type Order,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useWishlist } from '../lib/wishlist-context'
import { useToast } from '../lib/toast-context'
import { Badge, GlassButton, GlassPanel } from '../components/ui'

const TABS = ['orders', 'addresses', 'wishlist'] as const
type Tab = (typeof TABS)[number]

const STATUS_TONE: Record<Order['status'], 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  paid: 'default',
  processing: 'default',
  shipped: 'default',
  completed: 'success',
  cancelled: 'danger',
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listOrders()
      .then((result) => setOrders(result.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-500">Cargando pedidos…</p>
  if (orders.length === 0) return <p className="text-slate-500">Aún no tienes pedidos.</p>

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link key={order.id} to={`/account/orders/${order.id}`}>
          <GlassPanel className="flex items-center justify-between p-4 transition hover:border-cyan-300/30">
            <div>
              <p className="font-medium text-slate-100">Pedido #{order.id}</p>
              <p className="text-sm text-slate-400">{order.items.length} artículos · ${order.total}</p>
            </div>
            <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
          </GlassPanel>
        </Link>
      ))}
    </div>
  )
}

function AddressesTab() {
  const { push } = useToast()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listAddresses()
      .then(setAddresses)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: number) {
    try {
      await deleteAddress(id)
      setAddresses((current) => current.filter((address) => address.id !== id))
      push('Dirección eliminada', 'success')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo eliminar la dirección', 'error')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      const updated = await updateAddress(id, { is_default: true })
      setAddresses((current) => current.map((address) => (address.id === id ? updated : { ...address, is_default: false })))
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo actualizar la dirección', 'error')
    }
  }

  if (loading) return <p className="text-slate-500">Cargando direcciones…</p>
  if (addresses.length === 0) return <p className="text-slate-500">No tienes direcciones guardadas. Agrégalas durante el checkout.</p>

  return (
    <div className="space-y-4">
      {addresses.map((address) => (
        <GlassPanel key={address.id} className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{address.label || 'Dirección'}</span>
            {address.is_default ? (
              <Badge tone="success">Predeterminada</Badge>
            ) : (
              <button onClick={() => handleSetDefault(address.id)} className="text-xs text-cyan-300 hover:text-cyan-100">
                Marcar como predeterminada
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {address.street}, {address.city} {address.state ? `, ${address.state}` : ''} — {address.country}
          </p>
          <button onClick={() => handleDelete(address.id)} className="mt-2 text-xs text-slate-500 hover:text-rose-300">
            Eliminar
          </button>
        </GlassPanel>
      ))}
    </div>
  )
}

function WishlistTab() {
  const { wishlist, loading } = useWishlist()
  const { push } = useToast()
  const [, forceRerender] = useState(0)

  async function handleRemove(itemId: number) {
    try {
      await removeWishlistItem(itemId)
      forceRerender((value) => value + 1)
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo actualizar tu wishlist', 'error')
    }
  }

  if (loading) return <p className="text-slate-500">Cargando wishlist…</p>
  if (!wishlist || wishlist.items.length === 0) return <p className="text-slate-500">Tu wishlist está vacía.</p>

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {wishlist.items.map((item) => (
        <GlassPanel key={item.id} className="p-4">
          <Link to={`/products/${item.product.slug}`} className="font-medium text-slate-100 hover:text-cyan-200">
            {item.product.name}
          </Link>
          <p className="mt-1 text-sm text-slate-400">${item.product.base_price}</p>
          <button onClick={() => handleRemove(item.id)} className="mt-2 text-xs text-slate-500 hover:text-rose-300">
            Quitar
          </button>
        </GlassPanel>
      ))}
    </div>
  )
}

export function AccountPage() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('orders')

  useEffect(() => {
    if (!isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  if (!isAuthenticated || !user) return null

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mi cuenta</h1>
          <p className="mt-1 text-slate-400">
            {user.first_name} {user.last_name} · {user.email}
          </p>
        </div>
        <GlassButton
          variant="ghost"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          Cerrar sesión
        </GlassButton>
      </div>

      <div className="mt-8 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1 text-sm font-medium">
        {(['orders', 'addresses', 'wishlist'] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`flex-1 rounded-lg py-2 capitalize transition ${tab === item ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:text-white'}`}
          >
            {item === 'orders' ? 'Pedidos' : item === 'addresses' ? 'Direcciones' : 'Wishlist'}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'orders' && <OrdersTab />}
        {tab === 'addresses' && <AddressesTab />}
        {tab === 'wishlist' && <WishlistTab />}
      </div>
    </div>
  )
}
