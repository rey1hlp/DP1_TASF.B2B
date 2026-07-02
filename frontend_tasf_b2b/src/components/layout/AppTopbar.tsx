import type { ReactNode } from 'react'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

type AppTopbarProps = {
    topbarMain: ReactNode
    onToggleSidebar: () => void
  }

export default function AppTopbar({
    topbarMain,
    onToggleSidebar,
}: AppTopbarProps) {
  const { logout, user } = useAuth()
  const roleLabel =
    user?.role === 'ADMIN'
      ? 'ADMIN'
      : user?.role === 'LOGISTICS'
        ? `LOGISTICS ${user.airportCode ?? ''}`.trim()
        : user?.role === 'REGISTER'
          ? 'REGISTER'
          : user?.airportCode ?? 'Usuario'

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-icon-button"
          onClick={onToggleSidebar}
          aria-label="Alternar navegación"
        >
          <Menu size={22} />
        </button>

        <div className="topbar-brand">
          <div className="topbar-logo">TB</div>

          <div className="topbar-brand-text">
            <div className="topbar-brand-title">Tasf.B2B</div>
            <div className="topbar-brand-subtitle">AIR LOGISTICS</div>
          </div>
        </div>
      </div>

      <div className="topbar-main">
        {topbarMain}
      </div>

      <div className="topbar-actions">
        <div className="topbar-user-meta">
          <span>{user?.fullName ?? 'Usuario'}</span>
          <small>{roleLabel}</small>
        </div>
        <button
          type="button"
          className="topbar-user-button"
          onClick={logout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
