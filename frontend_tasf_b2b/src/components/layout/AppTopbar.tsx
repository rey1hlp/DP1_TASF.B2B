import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LogOut, Menu, Clock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getAirportByCode } from '../../services/api' // Asegúrate de que esta ruta sea la correcta

type AppTopbarProps = {
  topbarMain: ReactNode
  onToggleSidebar: () => void
}

// --- NUEVO COMPONENTE: RELOJ EN VIVO ---
function LiveClock({ airportCode, role }: { airportCode?: string | null, role?: string }) {
  const [time, setTime] = useState(new Date())
  const [gmtOffset, setGmtOffset] = useState<number | null>(null)

  // 1. Obtener el GMT del aeropuerto si el usuario no es ADMIN
  useEffect(() => {
    if (airportCode && role !== 'ADMIN') {
      getAirportByCode(airportCode)
        .then((airport) => setGmtOffset(airport.gmt))
        .catch((err) => console.error('Error al cargar GMT del reloj:', err))
    }
  }, [airportCode, role])

  // 2. Actualizar el tiempo cada segundo
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 3. Vista para el ADMIN (Muestra hora local de su computadora)
  if (role === 'ADMIN' || !airportCode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: '1rem', borderRight: '1px solid rgba(255,255,255,0.2)', marginRight: '1rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} />
          {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <small style={{ color: '#adb5bd', fontSize: '0.75rem', marginTop: '2px' }}>Local / Admin</small>
      </div>
    )
  }

  // Mientras carga el GMT de la base de datos
  if (gmtOffset === null) {
    return <div style={{ marginRight: '1rem', color: '#adb5bd', fontSize: '0.85rem' }}>Cargando hora...</div>
  }

  // 4. Calcular la hora en vivo para el Registrador según su GMT
  const utc = time.getTime() + time.getTimezoneOffset() * 60000
  const localTime = new Date(utc + 3600000 * gmtOffset)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      paddingRight: '1rem',
      borderRight: '1px solid rgba(255,255,255,0.2)',
      marginRight: '0.2rem',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Clock size={16} />
        {localTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <small style={{ color: '#adb5bd', fontSize: '0.75rem', marginTop: '2px' }}>
        Hora {airportCode} (GMT{gmtOffset > 0 ? '+' : ''}{gmtOffset})
      </small>
    </div>
  )
}
// ---------------------------------------

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

      <div className="topbar-main" style={{ flex: 1, minWidth: 0 }}>
        {topbarMain}
      </div>

      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexShrink: 0 }}>

        {/* AQUÍ INYECTAMOS EL RELOJ */}
        <LiveClock airportCode={user?.airportCode} role={user?.role} />

        <div className="topbar-user-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
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
