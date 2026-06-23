import {
    ClipboardList,
    Package,
    Plane,
    MapPin,
    FlaskConical,
    BarChart3,
    Settings,
    Bug,
  } from 'lucide-react'
  
  import SidebarNavItem from './SidebarNavItem'
  
  export default function AppSidebar() {
    return (
      <aside className="app-sidebar">
        <div className="profile">
          <div className="avatar">ER</div>
  
          <div>
            <div className="profile-name">Esteban Ramirez</div>
            <div className="profile-role">Supervisor de operaciones</div>
          </div>
        </div>
        <div className="spacer"></div>
        <nav className="nav">
          <SidebarNavItem to="/operacion-diaria" label="Operación diaria" icon={ClipboardList} />
          <SidebarNavItem to="/envios" label="Envíos" icon={Package} />
          <SidebarNavItem to="/vuelos" label="Vuelos" icon={Plane} />
          <SidebarNavItem to="/aeropuertos" label="Aeropuertos" icon={MapPin} />
          <SidebarNavItem to="/simulacion" label="Simulación" icon={FlaskConical} />
          <SidebarNavItem to="/reportes" label="Reportes" icon={BarChart3} />
          <SidebarNavItem to="/configuracion" label="Configuración" icon={Settings} />
          <SidebarNavItem to="/debug" label="Debug" icon={Bug} />
        </nav>
      </aside>
    )
  }