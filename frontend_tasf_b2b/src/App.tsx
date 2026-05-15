import { useEffect, useMemo, useState } from 'react'
import type { AirportDto } from './types/sim'
import { fetchAirports, startSimulation } from './services/api'
import { useSimulationSocket } from './hooks/useSimulationSocket'
import MapView from './components/MapView'
import SimulationStatus from './components/SimulationStatus'
import SimulationControls from './components/SimulationControls'
import { formatCompactDate, getDayIndexFromDateString, getInclusiveDaySpan } from './utils/time'

export default function App() {
  const [airports, setAirports] = useState<AirportDto[]>([])
  const [simId, setSimId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requestedStart, setRequestedStart] = useState<string | null>(null)
  const [requestedDays, setRequestedDays] = useState<number | null>(null)
  const [displayOffset, setDisplayOffset] = useState<number | null>(null)
  const [localCompleted, setLocalCompleted] = useState(false)
  const [ranges, setRanges] = useState({ greenMax: 30, amberMax: 70 })

  const { status, statusMessage, currentMinute, segments, meta, pause, resume } = useSimulationSocket(simId)

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch((err) => setError(err.message))
  }, [])

  const handleStart = async ({ inicio, dias }: { inicio: string; dias: number }) => {
    setError(null)
    setRequestedStart(inicio)
    setRequestedDays(dias)
    setDisplayOffset(null)
    setLocalCompleted(false)
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
        speedMinPerSec: 20,
      })
      setSimId(response.simulationId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    }
  }

  const requestedStartIndex = getDayIndexFromDateString(requestedStart)
  const requestedStartMinute = requestedStartIndex !== null ? requestedStartIndex * 1440 : null
  const requestedEndMinute =
    requestedStartMinute !== null && requestedDays !== null
      ? requestedStartMinute + requestedDays * 1440
      : null
  const isPreparing = (status === 'READY' || status === 'RUNNING') && currentMinute === null

  useEffect(() => {
    if (requestedStartMinute === null || currentMinute === null) {
      return
    }
    if (displayOffset === null) {
      setDisplayOffset(requestedStartMinute - currentMinute)
    }
  }, [requestedStartMinute, currentMinute, displayOffset])

  const displayMinuteRaw =
    currentMinute === null
      ? null
      : displayOffset !== null
        ? currentMinute + displayOffset
        : currentMinute

  const cappedSegments = requestedEndMinute
    ? segments.filter((seg) => seg.salidaMin < requestedEndMinute)
    : segments

  const activeSegmentsCount =
    displayMinuteRaw === null
      ? 0
      : cappedSegments.filter(
          (seg) => displayMinuteRaw >= seg.salidaMin && displayMinuteRaw <= seg.llegadaMin
        ).length

  useEffect(() => {
    if (localCompleted) {
      return
    }
    if (requestedEndMinute === null || displayMinuteRaw === null) {
      return
    }
    if (displayMinuteRaw >= requestedEndMinute && activeSegmentsCount === 0) {
      setLocalCompleted(true)
    }
  }, [localCompleted, requestedEndMinute, displayMinuteRaw, activeSegmentsCount])

  useEffect(() => {
    if (!localCompleted) {
      return
    }
    setSimId(null)
    setRequestedStart(null)
    setRequestedDays(null)
    setDisplayOffset(null)
  }, [localCompleted])

  const displayMinute =
    localCompleted && requestedEndMinute !== null
      ? null
      : displayMinuteRaw
  const duration =
    requestedDays ?? (meta ? getInclusiveDaySpan(meta.inicio, meta.fin) : null)
  const running = (status === 'READY' || status === 'RUNNING' || status === 'PAUSED') && !localCompleted
  const preparingMessage = isPreparing
    ? `Calculando simulacion hasta la fecha: ${formatCompactDate(requestedStart ?? meta?.inicio)}`
    : null
  const displayStartDate = formatCompactDate(requestedStart ?? meta?.inicio)
  const bannerMessage = (() => {
    if (status === 'COMPLETED') {
      return 'Simulacion finalizada con exito.'
    }
    if (status === 'FAILED') {
      return statusMessage || 'La simulacion finalizo con error.'
    }
    if (status === 'CLOSED') {
      return statusMessage || 'Conexion finalizada.'
    }
    if (localCompleted) {
      return 'Simulacion finalizada: todas las aeronaves llegaron a destino.'
    }
    return null
  })()

  const warehouseSnapshot = useMemo(() => {
    if (!meta?.almacenes || displayMinute === null) {
      return {}
    }
    const snapshot: Record<string, { capacidad: number; ocupacion: number; porcentaje: number; libre: number }> = {}
    meta.almacenes.forEach((almacen) => {
      let ocupacion = 0
      for (const evento of almacen.eventos) {
        if (evento.minuto > displayMinute) {
          break
        }
        ocupacion += evento.delta
      }
      const capacidad = almacen.capacidad || 1
      const libre = Math.max(0, capacidad - ocupacion)
      const porcentaje = (ocupacion * 100) / capacidad
      snapshot[almacen.codigoOaci] = {
        capacidad,
        ocupacion,
        porcentaje,
        libre,
      }
    })
    return snapshot
  }, [meta, displayMinute])

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
            <button className="tab active">Simulacion del periodo</button>
            <button className="tab">Simulacion hasta el colapso</button>
          </div>
          <div className="status">
            <div className="status-item">Fecha: <strong>{displayStartDate}</strong></div>
            <div className="status-item">Duracion: <strong>{duration ? `${duration} dias` : '--'}</strong></div>
            <div className="status-item">Vuelos activos: <strong>{cappedSegments.length}</strong></div>
            <div className="status-item">Maletas: <strong>{meta?.totalMaletas ?? '--'}</strong></div>
          </div>
        </section>

        <section className="map-area">
          <div className="map-placeholder">
            <SimulationStatus
              meta={meta}
              currentMinute={displayMinute}
              status={status}
              preparingMessage={preparingMessage}
            />
            <MapView
              airports={airports}
              segments={localCompleted ? [] : cappedSegments}
              currentMinute={displayMinute}
              warehouseSnapshot={warehouseSnapshot}
              ranges={ranges}
            />
            {isPreparing ? <div className="prep-overlay">{preparingMessage}</div> : null}
            {bannerMessage ? <div className="status-banner">{bannerMessage}</div> : null}
            {error ? <div className="error">{error}</div> : null}
          </div>

          <SimulationControls
            onStart={handleStart}
            onPause={pause}
            onResume={resume}
            isRunning={running}
            isPaused={status === 'PAUSED'}
            ranges={ranges}
            onRangesChange={setRanges}
          />
        </section>
      </main>
    </div>
  )
}
