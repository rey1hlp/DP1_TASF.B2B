import { Menu, Search, UserCircle } from 'lucide-react'

type AppTopbarProps = {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export default function AppTopbar({
  onToggleSidebar,
}: AppTopbarProps) {
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
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-user-button"
          aria-label="Perfil"
        >
          <UserCircle size={24} />
        </button>
      </div>
    </header>
  );
}