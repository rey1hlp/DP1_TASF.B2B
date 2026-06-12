import { useState } from 'react'
import { Outlet } from 'react-router'
import {
  ClipboardList,
  Package,
  Plane,
  MapPin,
  FlaskConical,
  BarChart3,
  Settings,
  Bug,
  Menu,
} from 'lucide-react'

import SidebarNavItem from '../components/ui/SidebarNavItem'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-hidden"}`}>
      {sidebarOpen && (
        <header className="sidebar">
          <div className="brand">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              aria-label="Ocultar navegación"
            >
              <Menu size={18} />
            </button>
            <div className="logo">TB</div>

            <div>
              <div className="brand-title">Tasf.B2B</div>
              <div className="brand-subtitle">Air Logistics</div>
            </div>
          </div>

          <div className="profile">
            <div className="avatar">ER</div>

            <div>
              <div className="profile-name">Esteban Ramirez</div>
              <div className="profile-role">Supervisor de operaciones</div>
            </div>
          </div>

          <nav className="nav">
            <SidebarNavItem
              to="/operacion-diaria"
              label="Operación diaria"
              icon={ClipboardList}
            />
            <SidebarNavItem to="/envios" label="Envíos" icon={Package} />
            <SidebarNavItem to="/vuelos" label="Vuelos" icon={Plane} />
            <SidebarNavItem
              to="/aeropuertos"
              label="Aeropuertos"
              icon={MapPin}
            />
            <SidebarNavItem
              to="/simulacion"
              label="Simulación"
              icon={FlaskConical}
            />
            <SidebarNavItem to="/reportes" label="Reportes" icon={BarChart3} />
            <SidebarNavItem
              to="/configuracion"
              label="Configuración"
              icon={Settings}
            />
            <SidebarNavItem to="/debug" label="Debug" icon={Bug} />
          </nav>
        </header>
      )}

      {!sidebarOpen && (
        <button
          type="button"
          className="sidebar-floating-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Mostrar navegación"
        >
          <Menu size={20} />
        </button>
      )}

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}