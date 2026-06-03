import { useState } from 'react'

interface LoginScreenProps {
  onLogin: (email: string, password: string) => void
  errorMessage?: string | null
}

export default function LoginScreen({ onLogin, errorMessage }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="panel-circle c1"></div>
        <div className="panel-circle c2"></div>
      </div>

      <div className="login-main">
        <div className="login-logo-block">
          <div className="login-logo-box">
            <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 27 Q10 22 18 23 L40 24 Q46 24 46 27 Q46 30 40 30 L18 31 Q10 32 6 27 Z" fill="white" fillOpacity="0.95" />
              <path d="M40 24 Q48 25.5 48 27 Q48 28.5 40 30 Z" fill="white" fillOpacity="0.7" />
              <path d="M20 24 L14 14 L12 14 L16 24 Z" fill="white" fillOpacity="0.9" />
              <path d="M24 30 L18 40 L16 40 L20 30 Z" fill="white" fillOpacity="0.7" />
              <path d="M10 23 L8 16 L12 16 L13 23 Z" fill="white" fillOpacity="0.85" />
              <path d="M8 27 L4 23 L6 23 L10 27 Z" fill="white" fillOpacity="0.7" />
              <path d="M8 27 L4 31 L6 31 L10 27 Z" fill="white" fillOpacity="0.7" />
              <circle cx="30" cy="27" r="1.2" fill="#2952c4" fillOpacity="0.5" />
              <circle cx="34" cy="27" r="1.2" fill="#2952c4" fillOpacity="0.5" />
              <circle cx="38" cy="27" r="1.2" fill="#2952c4" fillOpacity="0.5" />
            </svg>
          </div>
          <div className="login-logo-text">
            <h1>Tasf.B2B</h1>
            <p>Air Logistics</p>
          </div>
        </div>

        <div className="login-card">
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field password-field">
            <label htmlFor="pass">Contraseña</label>
            <div className="password-input-wrapper">
              <input
                id="pass"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {errorMessage ? <div className="login-error">{errorMessage}</div> : null}
          <button
            className="btn-login"
            type="button"
            disabled={!email || !password}
            onClick={() => onLogin(email, password)}
          >
            Iniciar sesión
          </button>
          <a href="#" className="forgot">Olvidé mi contraseña</a>
        </div>
      </div>
    </div>
  )
}
