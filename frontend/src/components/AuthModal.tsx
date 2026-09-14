import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useToast } from '../lib/toast-context'
import { GlassButton, GlassInput, Modal } from './ui'

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, register } = useAuth()
  const { push } = useToast()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setEmail('')
    setPassword('')
    setFirstName('')
    setLastName('')
    setError('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'login') {
        await login(email, password)
        push('Sesión iniciada correctamente', 'success')
      } else {
        await register({ email, password, first_name: firstName || undefined, last_name: lastName || undefined })
        push('Cuenta creada correctamente', 'success')
      }
      reset()
      onClose()
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Ocurrió un error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }}>
      <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 rounded-lg py-2 transition ${mode === 'login' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:text-white'}`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 rounded-lg py-2 transition ${mode === 'register' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:text-white'}`}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-3">
            <GlassInput placeholder="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <GlassInput placeholder="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
        )}
        <GlassInput
          type="email"
          required
          placeholder="Correo electrónico"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <GlassInput
          type="password"
          required
          minLength={8}
          placeholder="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <GlassButton type="submit" disabled={submitting} className="w-full justify-center">
          {submitting ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </GlassButton>
      </form>
    </Modal>
  )
}
