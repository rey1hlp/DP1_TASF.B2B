import {
  ClipboardList,
  Package,
  Plane,
  MapPin,
  FlaskConical,
  BarChart3,
  Settings,
  Bug,
  Users,
} from 'lucide-react'

import SidebarNavItem from './SidebarNavItem'
import { useAuth } from '../../contexts/AuthContext'

function getInitials(name?: string | null) {
  if (!name) return 'US'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'US'
}

export default function AppSidebar() {
  const { isAdmin, isLogistics, isRegister, user } = useAuth()
  const roleLabel =
    user?.role === 'ADMIN'
      ? 'Administrador global'
      : user?.role === 'LOGISTICS'
        ? `Logística ${user?.airportCode ?? ''}`.trim()
        : user?.role === 'REGISTER'
          ? 'Registro de envíos'
          : 'Usuario'

  return (
    <aside className="app-sidebar">
      <div className="profile">
        <div className="avatar">{getInitials(user?.fullName)}</div>

        <div>
          <div className="profile-name">{user?.fullName ?? 'Usuario'}</div>
          <div className="profile-role">{roleLabel}</div>
        </div>
      </div>
      <div className="spacer"></div>
      <nav className="nav">
        {isAdmin ? (
          <>
            <SidebarNavItem to="/operacion-diaria" label="Operación diaria" icon={ClipboardList} />
            <SidebarNavItem to="/envios" label="Envíos" icon={Package} />
            <SidebarNavItem to="/vuelos" label="Vuelos" icon={Plane} />
            <SidebarNavItem to="/aeropuertos" label="Aeropuertos" icon={MapPin} />
            <SidebarNavItem to="/simulacion" label="Simulación" icon={FlaskConical} />
            <SidebarNavItem to="/reportes" label="Reportes" icon={BarChart3} />
            <SidebarNavItem to="/configuracion" label="Configuración" icon={Settings} />
            <SidebarNavItem to="/debug" label="Debug" icon={Bug} />
            <SidebarNavItem to="/usuarios" label="Empleados" icon={Users} />
          </>
        ) : isLogistics ? (
          <SidebarNavItem to="/operacion-diaria" label="Operación diaria" icon={ClipboardList} />
        ) : isRegister ? (
          <SidebarNavItem to="/envios" label="Envíos" icon={Package} />
        ) : null}
      </nav>
    </aside>
  )
}
