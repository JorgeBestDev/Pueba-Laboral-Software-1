import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import * as adminApi from '../lib/admin-api'
import { Modal, PasswordInput } from '../components/ui'
import { useAdminAuth } from '../lib/admin-auth-context'
import { AdminBadge, AdminEmptyState, AdminPagination } from './AdminUI'

type CustomerFormState = {
  first_name: string
  last_name: string
  email: string
  password: string
  role: 'customer' | 'admin'
  is_active: boolean
}

const EMPTY_FORM: CustomerFormState = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  role: 'customer',
  is_active: true,
}

function formatCurrency(value: string | number) {
  const amount = typeof value === 'string' ? Number(value) : value
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`
}

function formatDate(value?: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function displayName(user: adminApi.AdminUser) {
  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return name || user.email
}

export function AdminCustomersPage() {
  const { admin } = useAdminAuth()
  const [users, setUsers] = useState<adminApi.AdminUser[]>([])
  const [meta, setMeta] = useState<{ page: number; pages: number } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState<adminApi.AdminUser | null>(null)

  const load = () => {
    setLoading(true)
    adminApi
      .listAdminUsers({
        page,
        q: search || undefined,
        role: role || undefined,
        is_active: status === '' ? undefined : status === 'active',
      })
      .then((response) => {
        setUsers(response.data)
        setMeta({ page: response.meta.page, pages: response.meta.pages })
        setError(null)
      })
      .catch((err) => setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudieron cargar los clientes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role, status])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (user: adminApi.AdminUser) => {
    setSelected(null)
    setEditingId(user.id)
    setForm({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
    })
    setFormOpen(true)
  }

  const openDetail = async (id: number) => {
    try {
      const user = await adminApi.getAdminUserDetail(id)
      setSelected(user)
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo cargar el cliente')
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          role: form.role,
          is_active: form.is_active,
        }
        if (form.password) payload.password = form.password
        await adminApi.updateAdminUser(editingId, payload)
      } else {
        await adminApi.createAdminUser({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        })
      }
      setFormOpen(false)
      load()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo guardar el usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: number) => {
    if (id === admin?.id) {
      setError('No puedes desactivar tu propia cuenta.')
      return
    }
    if (!window.confirm('¿Desactivar este usuario? No podrá iniciar sesión en la tienda ni en el panel.')) return
    try {
      await adminApi.deactivateAdminUser(id)
      if (selected?.id === id) {
        const updated = await adminApi.getAdminUserDetail(id)
        setSelected(updated)
      }
      load()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo desactivar el usuario')
    }
  }

  const handleReactivate = async (id: number) => {
    try {
      await adminApi.updateAdminUser(id, { is_active: true })
      if (selected?.id === id) {
        const updated = await adminApi.getAdminUserDetail(id)
        setSelected(updated)
      }
      load()
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo reactivar el usuario')
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setPage(1)
                load()
              }
            }}
            placeholder="Buscar por nombre o correo…"
            className="glass-input sm:max-w-xs"
          />
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
            className="glass-input sm:max-w-[180px]"
          >
            <option value="">Todos los roles</option>
            <option value="customer">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="glass-input sm:max-w-[180px]"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
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
        <button type="button" onClick={openCreate} className="glass-button !bg-black !text-white">
          + Nuevo usuario
        </button>
      </div>

      {error && <p className="border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <AdminEmptyState message="Cargando clientes…" />
        ) : users.length === 0 ? (
          <AdminEmptyState message="No se encontraron usuarios con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[0.65rem] uppercase tracking-widest text-neutral-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Correo</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium">{displayName(user)}</td>
                    <td className="px-4 py-3 text-neutral-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <AdminBadge tone={user.role === 'admin' ? 'info' : 'default'}>
                        {user.role === 'admin' ? 'Admin' : 'Cliente'}
                      </AdminBadge>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge tone={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </AdminBadge>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openDetail(user.id)}
                        className="mr-3 text-xs font-semibold uppercase tracking-widest underline underline-offset-4"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="mr-3 text-xs font-semibold uppercase tracking-widest underline underline-offset-4"
                      >
                        Editar
                      </button>
                      {user.is_active && user.id !== admin?.id && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(user.id)}
                          className="text-xs font-semibold uppercase tracking-widest text-red-600 underline underline-offset-4"
                        >
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && <AdminPagination page={meta.page} pages={meta.pages} onChange={setPage} />}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} className="max-w-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">{editingId ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black"
          >
            Cerrar ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.first_name}
              onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
              placeholder="Nombre"
              required
              className="glass-input"
            />
            <input
              value={form.last_name}
              onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
              placeholder="Apellido"
              required
              className="glass-input"
            />
          </div>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Correo electrónico"
            required
            className="glass-input"
          />
          <PasswordInput
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={editingId ? 'Nueva contraseña (opcional)' : 'Contraseña (mín. 8 caracteres)'}
            minLength={editingId ? undefined : 8}
            required={!editingId}
            className=""
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as 'customer' | 'admin' }))}
              className="glass-input"
            >
              <option value="customer">Cliente</option>
              <option value="admin">Administrador</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                disabled={editingId === admin?.id}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              />
              Activo
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="glass-button !border !border-neutral-300 !bg-white !text-black"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="glass-button !bg-black !text-white">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={selected !== null} onClose={() => setSelected(null)} className="max-w-lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">{displayName(selected)}</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black"
              >
                Cerrar ✕
              </button>
            </div>
            <p className="text-sm text-neutral-500">{selected.email}</p>
            <div className="flex flex-wrap gap-2">
              <AdminBadge tone={selected.role === 'admin' ? 'info' : 'default'}>
                {selected.role === 'admin' ? 'Admin' : 'Cliente'}
              </AdminBadge>
              <AdminBadge tone={selected.is_active ? 'success' : 'danger'}>
                {selected.is_active ? 'Activo' : 'Inactivo'}
              </AdminBadge>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="border border-neutral-200 p-3">
                <dt className="text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Pedidos</dt>
                <dd className="mt-1 font-display text-xl">{selected.stats?.orders_count ?? 0}</dd>
              </div>
              <div className="border border-neutral-200 p-3">
                <dt className="text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">Gastado</dt>
                <dd className="mt-1 font-display text-xl">{formatCurrency(selected.stats?.total_spent ?? '0')}</dd>
              </div>
            </dl>
            <p className="text-xs text-neutral-500">Alta: {formatDate(selected.created_at)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => openEdit(selected)} className="glass-button !border !border-neutral-300 !bg-white !text-black">
                Editar
              </button>
              {selected.is_active && selected.id !== admin?.id ? (
                <button type="button" onClick={() => handleDeactivate(selected.id)} className="glass-button !bg-red-600 !text-white">
                  Desactivar
                </button>
              ) : !selected.is_active ? (
                <button type="button" onClick={() => handleReactivate(selected.id)} className="glass-button !bg-black !text-white">
                  Reactivar
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
