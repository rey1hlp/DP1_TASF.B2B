import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Lock, LogIn, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type LoginLocationState = {
  from?: {
    pathname?: string
  }
}

export default function LoginPage() {
  const location = useLocation()
  const { isAuthenticated, login, status } = useAuth()
  const [email, setEmail] = useState('admin@tasf.local')
  const [password, setPassword] = useState('Tasf2026!')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const state = location.state as LoginLocationState | null
  const targetPath = state?.from?.pathname ?? '/'

  if (isAuthenticated) {
    return <Navigate to={targetPath} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await login(email, password)
    } catch {
      setError('Correo o contraseña inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Inicio de sesión">
        <div className="login-brand">
          <div className="login-logo">TB</div>
          <div>
            <h1>Tasf.B2B</h1>
            <p>AIR LOGISTICS</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Correo</span>
            <div className="login-input">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <div className="login-input">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-submit"
            disabled={submitting || status === 'loading'}
          >
            <LogIn size={18} />
            <span>{submitting ? 'Ingresando...' : 'Ingresar'}</span>
          </button>
        </form>
      </section>
    </main>
  )
}
