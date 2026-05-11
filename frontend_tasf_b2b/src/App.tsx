import { useEffect, useState } from 'react'
import type { AirportDto } from './types/sim'
import { fetchAirports, startSimulation } from './services/api'
import { useSimulationSocket } from './hooks/useSimulationSocket'
import MapView from './components/MapView'
import SimulationStatus from './components/SimulationStatus'
import SimulationControls from './components/SimulationControls'

export default function App() {
  const [airports, setAirports] = useState<AirportDto[]>([])
  const [simId, setSimId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { status, currentMinute, segments, meta } = useSimulationSocket(simId)

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch((err) => setError(err.message))
  }, [])

  const handleStart = async ({ inicio, dias }: { inicio: string; dias: number }) => {
    setError(null)
    try {
      const response = await startSimulation({
        envios: '_envios_preliminar_',
        inicio: inicio.replaceAll('-', ''),
        dias,
        maxEnvios: 5000000,
        poblacion: 50,
        generaciones: 10,
        reporte: false,
        paralelo: true,
        hilos: 6,
        estancamiento: 3,
        speedMinPerSec: 6,
      })
      setSimId(response.simulationId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    }
  }

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
          <button className="nav-item">Envios</button>
          <button className="nav-item">Vuelos</button>
          <button className="nav-item">Almacenes</button>
          <button className="nav-item active">Simulacion</button>
          <button className="nav-item">Reportes</button>
          <button className="nav-item">Configuracion</button>
        </nav>
      </header>

      <main className="main">
        <section className="toolbar">
          <div className="tabs">
            <button className="tab">Escenario diario</button>
            <button className="tab active">Simulacion del periodo</button>
            <button className="tab">Simulacion hasta el colapso</button>
          </div>
          <div className="status">
            <div className="status-item">Fecha: <strong>{meta?.inicio ?? '--'}</strong></div>
            <div className="status-item">Duracion: <strong>{meta ? `${meta.diaMax - meta.diaMin + 1} dias` : '--'}</strong></div>
            <div className="status-item">Vuelos activos: <strong>{segments.length}</strong></div>
            <div className="status-item">Maletas: <strong>{meta?.totalMaletas ?? '--'}</strong></div>
          </div>
        </section>

        <section className="map-area">
          <div className="map-placeholder">
            <SimulationStatus meta={meta} currentMinute={currentMinute} />
            <MapView airports={airports} segments={segments} currentMinute={currentMinute} />
            {error ? <div className="error">{error}</div> : null}
          </div>

          <SimulationControls onStart={handleStart} isRunning={status === 'READY' || status === 'RUNNING'} />
        </section>
      </main>
    </div>
  )
}
