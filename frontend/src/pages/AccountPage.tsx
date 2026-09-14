import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ApiError,
  deleteAddress,
  listAddresses,
  listOrders,
  ORDER_STATUS_LABEL,
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

  if (loading) return <p className="text-neutral-500">Cargando pedidos…</p>
  if (orders.length === 0) return <p className="text-neutral-500">Aún no tienes pedidos.</p>

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link key={order.id} to={`/account/orders/${order.id}`}>
          <GlassPanel className="flex items-center justify-between p-5 transition hover:border-black">
            <div>
              <p className="font-medium">Pedido #{order.id}</p>
              <p className="text-sm text-neutral-600">{order.items.length} artículos · ${order.total}</p>
            </div>
            <Badge tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
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

  if (loading) return <p className="text-neutral-500">Cargando direcciones…</p>
  if (addresses.length === 0) return <p className="text-neutral-500">No tienes direcciones guardadas. Agrégalas durante el checkout.</p>

  return (
    <div className="space-y-4">
      {addresses.map((address) => (
        <GlassPanel key={address.id} className="p-5">
          <div className="flex items-center justify-between">
            <span className="font-medium">{address.label || 'Dirección'}</span>
            {address.is_default ? (
              <Badge tone="success">Predeterminada</Badge>
            ) : (
              <button type="button" onClick={() => handleSetDefault(address.id)} className="text-xs uppercase tracking-wider underline underline-offset-4 hover:opacity-70">
                Marcar como predeterminada
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {address.street}, {address.city} {address.state ? `, ${address.state}` : ''} — {address.country}
          </p>
          <button type="button" onClick={() => handleDelete(address.id)} className="mt-2 text-xs uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:text-black">
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
      push(error instanceof ApiError ? error.message : 'No se pudo actualizar tu lista de deseos', 'error')
    }
  }

  if (loading) return <p className="text-neutral-500">Cargando lista de deseos…</p>
  if (!wishlist || wishlist.items.length === 0) return <p className="text-neutral-500">Tu lista de deseos está vacía.</p>

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {wishlist.items.map((item) => (
        <GlassPanel key={item.id} className="p-5">
          <Link to={`/products/${item.product.slug}`} className="text-xs font-medium uppercase tracking-wide hover:opacity-70">
            {item.product.name}
          </Link>
          <p className="mt-1 font-bold">${item.product.base_price}</p>
          <button type="button" onClick={() => handleRemove(item.id)} className="mt-2 text-xs uppercase tracking-wider text-neutral-500 underline underline-offset-4 hover:text-black">
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
    <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight">Mi cuenta</h1>
          <p className="mt-1 text-neutral-600">
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

      <div className="mt-8 flex gap-0 border border-neutral-200 text-sm font-medium">
        {(['orders', 'addresses', 'wishlist'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-wider transition ${
              tab === item ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
            }`}
          >
            {item === 'orders' ? 'Pedidos' : item === 'addresses' ? 'Direcciones' : 'Lista de deseos'}
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
