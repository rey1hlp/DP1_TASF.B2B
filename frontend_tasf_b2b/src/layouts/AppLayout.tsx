import { NavLink, Outlet } from 'react-router'

export default function AppLayout() {
  return (
    <div className="app">
      <header className="sidebar">
        <div className="brand">
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
          <NavLink className="nav-link" to="/operacion-diaria" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Operación diaria
          </NavLink>

          <NavLink to="/envios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Envíos
          </NavLink>

          <NavLink to="/vuelos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Vuelos
          </NavLink>

          <NavLink to="/aeropuertos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Aeropuertos
          </NavLink>

          <NavLink to="/simulacion" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Simulación
          </NavLink>

          <NavLink to="/reportes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Reportes
          </NavLink>

          <NavLink to="/configuracion" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Configuración
          </NavLink>

          <NavLink to="/debug" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Debug
          </NavLink>
        </nav>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}