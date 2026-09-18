import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
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
import { Badge, GlassButton, GlassInput, GlassPanel, PasswordInput } from '../components/ui'

const TABS = ['orders', 'addresses', 'wishlist', 'profile'] as const
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

function ProfileTab() {
  const { user, updateProfile, changePassword } = useAuth()
  const { push } = useToast()
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    try {
      await updateProfile({ first_name: firstName, last_name: lastName, email })
      push('Datos personales actualizados', 'success')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudieron actualizar tus datos', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      push('Las contraseñas nuevas no coinciden', 'error')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      push('Contraseña actualizada correctamente', 'success')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo actualizar la contraseña', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="p-5">
        <h2 className="font-display text-lg uppercase tracking-tight">Datos personales</h2>
        <p className="mt-1 text-sm text-neutral-500">Actualiza la información asociada a tu cuenta.</p>
        <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput required placeholder="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <GlassInput required placeholder="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <GlassInput required type="email" placeholder="Correo electrónico" value={email} onChange={(event) => setEmail(event.target.value)} />
          <GlassButton type="submit" disabled={savingProfile}>
            {savingProfile ? 'Guardando…' : 'Guardar cambios'}
          </GlassButton>
        </form>
      </GlassPanel>

      <GlassPanel className="p-5">
        <h2 className="font-display text-lg uppercase tracking-tight">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-neutral-500">Por seguridad, confirma tu contraseña actual.</p>
        <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
          <PasswordInput required minLength={8} placeholder="Contraseña actual" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput required minLength={8} placeholder="Nueva contraseña" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <PasswordInput required minLength={8} placeholder="Confirmar nueva contraseña" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <GlassButton type="submit" variant="ghost" disabled={savingPassword}>
            {savingPassword ? 'Actualizando…' : 'Cambiar contraseña'}
          </GlassButton>
        </form>
      </GlassPanel>
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
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-wider transition ${
              tab === item ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
            }`}
          >
            {item === 'orders'
              ? 'Pedidos'
              : item === 'addresses'
                ? 'Direcciones'
                : item === 'wishlist'
                  ? 'Lista de deseos'
                  : 'Mi perfil'}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'orders' && <OrdersTab />}
        {tab === 'addresses' && <AddressesTab />}
        {tab === 'wishlist' && <WishlistTab />}
        {tab === 'profile' && <ProfileTab />}
      </div>
    </div>
  )
}
