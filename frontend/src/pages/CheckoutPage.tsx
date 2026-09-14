import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ApiError,
  checkout as submitCheckout,
  createAddress,
  listAddresses,
  ORDER_STATUS_LABEL,
  type Address,
  type Order,
  type PaymentMethod,
} from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useCart } from '../lib/cart-context'
import { useToast } from '../lib/toast-context'
import { Badge, GlassButton, GlassInput, GlassPanel } from '../components/ui'

const STEPS = ['Dirección', 'Pago', 'Resumen'] as const

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: 'card', label: 'Tarjeta', hint: 'Débito o crédito' },
  { value: 'paypal', label: 'PayPal', hint: 'Pago con tu cuenta PayPal' },
  { value: 'cash_on_delivery', label: 'Contraentrega', hint: 'Paga al recibir tu pedido' },
]

function AddressForm({ onCreated }: { onCreated: (address: Address) => void }) {
  const { push } = useToast()
  const [form, setForm] = useState({ label: '', street: '', city: '', state: '', postal_code: '', country: '', is_default: false })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const address = await createAddress(form)
      onCreated(address)
      push('Dirección guardada', 'success')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'No se pudo guardar la dirección', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-dashed border-neutral-300 p-5">
      <div className="grid grid-cols-2 gap-3">
        <GlassInput placeholder="Etiqueta (Casa, Oficina...)" required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
        <GlassInput placeholder="País" required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
      </div>
      <GlassInput placeholder="Calle y número" required value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} />
      <div className="grid grid-cols-3 gap-3">
        <GlassInput placeholder="Ciudad" required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
        <GlassInput placeholder="Estado/Depto" required value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
        <GlassInput placeholder="Código postal" required value={form.postal_code} onChange={(event) => setForm({ ...form, postal_code: event.target.value })} />
      </div>
      <GlassButton type="submit" disabled={submitting} variant="ghost" className="w-full justify-center">
        {submitting ? 'Guardando…' : 'Guardar dirección'}
      </GlassButton>
    </form>
  )
}

export function CheckoutPage() {
  const { isAuthenticated } = useAuth()
  const { cart, reload: reloadCart } = useCart()
  const { push } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return
    listAddresses()
      .then((result) => {
        setAddresses(result)
        const defaultAddress = result.find((address) => address.is_default) ?? result[0]
        if (defaultAddress) setSelectedAddress(defaultAddress.id)
        else setShowAddressForm(true)
      })
      .catch(() => undefined)
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center lg:px-8">
        <GlassPanel className="p-10">
          <h1 className="font-display text-2xl uppercase">Inicia sesión para continuar</h1>
          <p className="mt-3 text-neutral-600">Necesitas una cuenta para completar tu compra y hacer seguimiento de tu pedido.</p>
          <Link to="/" className="mt-6 inline-block text-xs uppercase tracking-wider underline underline-offset-4 hover:opacity-70">
            ← Volver al catálogo
          </Link>
        </GlassPanel>
      </div>
    )
  }

  if (order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 lg:px-8">
        <GlassPanel className="p-10 text-center">
          <Badge tone="success">Pedido confirmado</Badge>
          <h1 className="font-display mt-4 text-3xl">¡Gracias por tu compra!</h1>
          <p className="mt-3 text-neutral-600">
            Pedido #{order.id} por ${order.total}. Estado actual: <span className="font-medium text-black">{ORDER_STATUS_LABEL[order.status]}</span>
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <GlassButton onClick={() => navigate(`/account/orders/${order.id}`)}>Ver seguimiento</GlassButton>
            <GlassButton variant="ghost" onClick={() => navigate('/')}>
              Seguir comprando
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center lg:px-8">
        <GlassPanel className="p-10">
          <h1 className="font-display text-2xl uppercase">Tu carrito está vacío</h1>
          <p className="mt-3 text-neutral-600">Añade productos antes de continuar con el pago.</p>
          <Link to="/" className="mt-6 inline-block text-xs uppercase tracking-wider underline underline-offset-4 hover:opacity-70">
            ← Explorar catálogo
          </Link>
        </GlassPanel>
      </div>
    )
  }

  async function handleConfirm() {
    if (!cart || !selectedAddress) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitCheckout({
        cart_id: cart.id,
        address_id: selectedAddress,
        payment_method: paymentMethod,
        idempotencyKey,
      })
      setOrder(result)
      await reloadCart()
      push('Pedido creado exitosamente', 'success')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'No se pudo procesar el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
      <h1 className="font-display text-3xl uppercase tracking-tight">Finalizar compra</h1>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center border text-sm font-semibold ${
                index <= step ? 'border-black bg-black text-white' : 'border-neutral-300 text-neutral-400'
              }`}
            >
              {index + 1}
            </div>
            <span className={`text-sm uppercase tracking-wider ${index <= step ? 'text-black' : 'text-neutral-400'}`}>{label}</span>
            {index < STEPS.length - 1 && <div className="hidden h-px w-8 bg-neutral-200 sm:block" />}
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <GlassPanel className="p-6">
          {step === 0 && (
            <div>
              <h2 className="font-display text-lg uppercase">Selecciona una dirección de envío</h2>
              <div className="mt-4 space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setSelectedAddress(address.id)}
                    className={`block w-full border p-4 text-left transition ${
                      selectedAddress === address.id ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{address.label || 'Dirección'}</span>
                      {address.is_default && <Badge>Predeterminada</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      {address.street}, {address.city} {address.state ? `, ${address.state}` : ''} — {address.country}
                    </p>
                  </button>
                ))}
              </div>
              {showAddressForm || addresses.length === 0 ? (
                <div className="mt-4">
                  <AddressForm
                    onCreated={(address) => {
                      setAddresses((current) => [...current, address])
                      setSelectedAddress(address.id)
                      setShowAddressForm(false)
                    }}
                  />
                </div>
              ) : (
                <button type="button" onClick={() => setShowAddressForm(true)} className="mt-4 text-xs uppercase tracking-wider underline underline-offset-4 hover:opacity-70">
                  + Añadir nueva dirección
                </button>
              )}
              <GlassButton className="mt-6 w-full justify-center" disabled={!selectedAddress} onClick={() => setStep(1)}>
                Continuar
              </GlassButton>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-lg uppercase">Método de pago</h2>
              <div className="mt-4 space-y-3">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentMethod(option.value)}
                    className={`block w-full border p-4 text-left transition ${
                      paymentMethod === option.value ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-neutral-600">{option.hint}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <GlassButton variant="ghost" onClick={() => setStep(0)}>
                  Atrás
                </GlassButton>
                <GlassButton className="flex-1 justify-center" onClick={() => setStep(2)}>
                  Continuar
                </GlassButton>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-lg uppercase">Confirma tu pedido</h2>
              <p className="mt-2 text-sm text-neutral-600">Revisa los detalles antes de finalizar. Este proceso es seguro contra envíos duplicados.</p>
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              <div className="mt-6 flex gap-3">
                <GlassButton variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
                  Atrás
                </GlassButton>
                <GlassButton className="flex-1 justify-center" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? 'Procesando…' : `Pagar $${cart.total}`}
                </GlassButton>
              </div>
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="h-fit p-6">
          <h2 className="font-display text-lg uppercase">Resumen del pedido</h2>
          <ul className="mt-4 space-y-3">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-neutral-600">
                  Variante #{item.variant_id} × {item.quantity}
                </span>
                <span className="font-medium">${item.unit_price ? (Number(item.unit_price) * item.quantity).toFixed(2) : '0.00'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-neutral-200 pt-4 text-lg font-bold">
            <span>Total</span>
            <span>${cart.total}</span>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
