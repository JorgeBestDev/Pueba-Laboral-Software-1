import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, requestPasswordReset } from '../lib/api'
import { GlassButton, GlassInput, GlassPanel } from '../components/ui'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setMessage(await requestPasswordReset(email))
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'No se pudo solicitar la recuperación')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-16 lg:px-8">
      <GlassPanel className="w-full p-6 sm:p-8">
        <p className="font-display text-xl italic">vokter.</p>
        <h1 className="mt-5 font-display text-3xl uppercase tracking-tight">Recuperar contraseña</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Escribe el correo asociado a tu cuenta. Si existe, recibirás un enlace para crear una nueva contraseña.
        </p>
        {message ? (
          <div className="mt-6 space-y-4">
            <p className="border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">{message}</p>
            <Link to="/" className="text-sm font-semibold underline">Volver a la tienda</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <GlassInput
              required
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <GlassButton type="submit" disabled={submitting} className="w-full justify-center">
              {submitting ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </GlassButton>
            <Link to="/" className="block text-center text-sm text-neutral-600 underline">Volver</Link>
          </form>
        )}
      </GlassPanel>
    </section>
  )
}
