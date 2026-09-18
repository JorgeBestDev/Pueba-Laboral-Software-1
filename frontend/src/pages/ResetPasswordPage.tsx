import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, resetPassword } from '../lib/api'
import { GlassButton, GlassPanel, PasswordInput } from '../components/ui'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await resetPassword({ token, new_password: password })
      setSuccess(true)
      setTimeout(() => navigate('/'), 1800)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'No se pudo actualizar la contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-16 lg:px-8">
      <GlassPanel className="w-full p-6 sm:p-8">
        <p className="font-display text-xl italic">vokter.</p>
        <h1 className="mt-5 font-display text-3xl uppercase tracking-tight">Nueva contraseña</h1>
        {!token ? (
          <p className="mt-5 text-sm text-red-600">El enlace de recuperación no es válido.</p>
        ) : success ? (
          <div className="mt-5 space-y-3 text-sm text-neutral-700">
            <p>Tu contraseña fue actualizada. Ya puedes iniciar sesión.</p>
            <Link to="/" className="font-semibold underline">Volver a la tienda</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <PasswordInput required minLength={8} placeholder="Nueva contraseña" value={password} onChange={(event) => setPassword(event.target.value)} />
            <PasswordInput required minLength={8} placeholder="Confirmar contraseña" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <GlassButton type="submit" disabled={submitting} className="w-full justify-center">
              {submitting ? 'Actualizando…' : 'Guardar nueva contraseña'}
            </GlassButton>
          </form>
        )}
      </GlassPanel>
    </section>
  )
}
