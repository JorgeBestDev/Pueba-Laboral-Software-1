import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import * as adminApi from '../lib/admin-api'
import { useAdminAuth } from '../lib/admin-auth-context'
import { PasswordInput } from '../components/ui'

export function AdminLoginPage() {
  const { admin, loading, login } = useAdminAuth()
  const navigate = useNavigate()

  const [captcha, setCaptcha] = useState<adminApi.CaptchaChallenge | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadCaptcha = async () => {
    setCaptchaLoading(true)
    setCaptchaAnswer('')
    try {
      const challenge = await adminApi.getCaptcha()
      setCaptcha(challenge)
    } catch {
      setCaptcha(null)
    } finally {
      setCaptchaLoading(false)
    }
  }

  useEffect(() => {
    loadCaptcha()
  }, [])

  if (!loading && admin) return <Navigate to="/admin" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!captcha) return
    setError(null)
    setSubmitting(true)
    try {
      await login({
        email,
        password,
        captcha_token: captcha.token,
        captcha_answer: Number(captchaAnswer),
      })
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof adminApi.AdminApiError ? err.message : 'No se pudo iniciar sesión')
      loadCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl italic tracking-tight">
            vokter<span className="text-cyan-400">.</span>
          </p>
          <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-400">
            Panel administrativo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 !border-white/10 !bg-neutral-950 p-6">
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-400">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="glass-input !border-white/20 !bg-neutral-900 !text-white"
              placeholder="admin@vokter.com"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-400">
              Contraseña
            </label>
            <PasswordInput
              id="admin-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="!border-white/20 !bg-neutral-900 !text-white"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label htmlFor="admin-captcha" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-400">
              Verificación de seguridad
            </label>
            <div className="mb-2 flex items-center justify-between border border-white/20 bg-neutral-900 px-4 py-3">
              <span className="font-display text-lg tracking-wide">
                {captchaLoading ? 'Cargando…' : (captcha?.question ?? 'Error al cargar')}
              </span>
              <button
                type="button"
                onClick={loadCaptcha}
                className="text-xs text-neutral-400 underline underline-offset-2 hover:text-white"
                aria-label="Recargar verificación"
              >
                Recargar
              </button>
            </div>
            <input
              id="admin-captcha"
              type="number"
              required
              value={captchaAnswer}
              onChange={(event) => setCaptchaAnswer(event.target.value)}
              className="glass-input !border-white/20 !bg-neutral-900 !text-white"
              placeholder="Resultado"
            />
          </div>

          {error && <p className="border border-red-900 bg-red-950/60 px-3 py-2 text-xs text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting || captchaLoading || !captcha}
            className="glass-button w-full !bg-white !text-black hover:!bg-neutral-200"
          >
            {submitting ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">Acceso restringido solo a personal autorizado.</p>
      </div>
    </div>
  )
}
