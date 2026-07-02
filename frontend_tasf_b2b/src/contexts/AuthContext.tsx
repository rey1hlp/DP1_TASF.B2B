import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuthToken,
  getAuthToken,
  getCurrentUser,
  login as loginRequest,
  setAuthToken,
  type AuthUser,
} from '../services/api'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const logout = useCallback(() => {
    clearAuthToken()
    setUser(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      if (!getAuthToken()) {
        setStatus('anonymous')
        return
      }

      try {
        const currentUser = await getCurrentUser()
        if (!cancelled) {
          setUser(currentUser)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) {
          logout()
        }
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [logout])

  useEffect(() => {
    window.addEventListener('tasf:auth:unauthorized', logout)
    return () => {
      window.removeEventListener('tasf:auth:unauthorized', logout)
    }
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password)
    setAuthToken(response.accessToken)
    setUser(response.user)
    setStatus('authenticated')
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isAdmin: user?.role === 'ADMIN',
      login,
      logout,
    }
  }, [login, logout, status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
