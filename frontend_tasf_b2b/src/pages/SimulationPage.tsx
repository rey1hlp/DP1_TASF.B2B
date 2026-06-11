import { useEffect, useMemo, useState } from 'react' // ✅ useState importado
import type { AirportDto } from '../types/sim'
import { fetchAirports, startSimulation } from '../services/api'
import { useSimulationSocket } from '../hooks/useSimulationSocket'
import MapView from '../components/MapView'
import SimulationStatus from '../components/SimulationStatus'
import SimulationControls from '../components/SimulationControls'
import UploadEnvios from '../components/UploadEnvios'
import { useSimulationContext } from '../contexts/SimulationContext'

import {
  formatCompactDate,
  getDayIndexFromDateString,
  getInclusiveDaySpan,
} from '../utils/time'

export type PasoRutaDto = {
  vueloId: number
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
}

export type RespuestaRutaEnvioDto = {
  codigoPedido: string
  estado: string
  tiempoTotalHoras: number
  ruta: PasoRutaDto[]
}

const SIMULATION_API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

async function fetchShipmentRoute(
  simId: string,
  codigo: string
): Promise<RespuestaRutaEnvioDto> {
  const res = await fetch(
    `${SIMULATION_API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments/${encodeURIComponent(codigo)}/route`
  )
  if (!res.ok) {
    throw new Error('No se pudo obtener la ruta del envío')
  }
  return res.json()
}

async function fetchSimulationShipments(simId: string, minute: number | null): Promise<string[]> {
  const url = new URL(`${SIMULATION_API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments`)
  if (minute !== null) {
    url.searchParams.append('minute', minute.toString())
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    return []
  }
  return res.json()
}

export default function SimulationPage() {
  const [airports, setAirports] = useState<AirportDto[]>([]) // ✅ useState con tipo
  const [error, setError] = useState<string | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)
  const [selectedAirportCode, setSelectedAirportCode] = useState<string | null>(null)

  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState<RespuestaRutaEnvioDto | null>(null)
  const [shipmentSearchError, setShipmentSearchError] = useState<string | null>(null)
  const [sampleShipments, setSampleShipments] = useState<string[]>([])

  const { enviosKey, setEnviosKey, simulation, setSimulation, resetSimulation } =
    useSimulationContext()

  const {
    simId,
    requestedStart,
    requestedDays,
    displayOffset,
    localCompleted,
    ranges,
  } = simulation

  const { status, statusMessage, currentMinute, segments, meta, pause, resume } =
    useSimulationSocket(simId)

  // Cargar aeropuertos una sola vez
  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch((err) => setError(err.message))
  }, [])

  const handleEnviosUploaded = (key: string) => {
    setEnviosKey(key)
  }

  const handleStart = async ({ inicio, dias }: { inicio: string; dias: number }) => {
    setError(null)
    setSimulation((prev) => ({
      ...prev,
      requestedStart: inicio,
      requestedDays: dias,
      displayOffset: null,
      localCompleted: false,
    }))
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
    setSampleShipments([])

    try {
      if (!enviosKey) {
        throw new Error('Debes cargar los archivos de envios antes de simular.')
      }

      const dateOnly = inicio.substring(0, 10).replaceAll('-', '')
      const response = await startSimulation({
        envios: enviosKey,
        inicio: dateOnly,
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

      setSimulation((prev) => ({ ...prev, simId: response.simulationId }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    }
  }

  const handleSearchShipment = async (codigo: string) => {
    if (!codigo || !simId) return
    try {
      setShipmentSearchError(null)
      const route = await fetchShipmentRoute(simId, codigo)
      setSelectedShipmentRoute(route)
    } catch (err) {
      setSelectedShipmentRoute(null)
      setShipmentSearchError('No se encontró la ruta para el maleta/envío.')
    }
  }

  const requestedStartOnlyDate = requestedStart ? requestedStart.substring(0, 10) : null
  const requestedStartIndex = requestedStartOnlyDate ? getDayIndexFromDateString(requestedStartOnlyDate) : null

  let requestedStartMinute: number | null = null
  if (requestedStartIndex !== null && requestedStart) {
    requestedStartMinute = requestedStartIndex * 1440
    if (requestedStart.includes('T')) {
      const timePart = requestedStart.split('T')[1]
      if (timePart) {
        const [hh, mm] = timePart.split(':').map(Number)
        requestedStartMinute += (hh * 60) + mm
      }
    }
  }

  const requestedEndMinute =
    requestedStartMinute !== null && requestedDays !== null
      ? requestedStartMinute + requestedDays * 1440
      : null

  const isPreparing = (status === 'READY' || status === 'RUNNING') && currentMinute === null

  // Calcular offset entre el minuto solicitado y el real
  useEffect(() => {
    if (requestedStartMinute === null || currentMinute === null) return
    if (displayOffset === null) {
      setSimulation((prev) => ({
        ...prev,
        displayOffset: requestedStartMinute - currentMinute,
      }))
    }
  }, [requestedStartMinute, currentMinute, displayOffset, setSimulation])

  const displayMinuteRaw =
    currentMinute === null
      ? null
      : displayOffset !== null
        ? currentMinute + displayOffset
        : currentMinute

  // Extraemos el minuto truncado cada 15 minutos de la simulación (ej. 1440, 1455, 1470) para no saturar con consultas por segundo
  const simulatedQuarterMinute = displayMinuteRaw !== null ? Math.floor(displayMinuteRaw / 15) * 15 : null;

  // Obtener las muestras de envíos en tránsito
  useEffect(() => {
    if (simId && meta && (status === 'READY' || status === 'RUNNING' || status === 'COMPLETED' || status === 'PAUSED')) {
      fetchSimulationShipments(simId, simulatedQuarterMinute).then(setSampleShipments).catch(() => setSampleShipments([]))
    }
  }, [simId, meta, status, simulatedQuarterMinute])

  const cappedSegments = requestedEndMinute
    ? segments.filter((seg) => seg.salidaMin < requestedEndMinute)
    : segments

  const activeSegmentsCount =
    displayMinuteRaw === null
      ? 0
      : cappedSegments.filter(
          (seg) => displayMinuteRaw >= seg.salidaMin && displayMinuteRaw <= seg.llegadaMin
        ).length

  // Detectar fin de simulación (local)
  useEffect(() => {
    if (localCompleted) return
    if (requestedEndMinute === null || displayMinuteRaw === null) return
    if (displayMinuteRaw >= requestedEndMinute && activeSegmentsCount === 0) {
      setSimulation((prev) => ({ ...prev, localCompleted: true }))
    }
  }, [localCompleted, requestedEndMinute, displayMinuteRaw, activeSegmentsCount, setSimulation])

  // Cuando se completa localmente, limpiar todo (resetea simulación)
  useEffect(() => {
    if (localCompleted) {
      resetSimulation()
    }
  }, [localCompleted, resetSimulation])

  const displayMinute =
    localCompleted && requestedEndMinute !== null ? null : displayMinuteRaw

  const duration = requestedDays ?? (meta ? getInclusiveDaySpan(meta.inicio, meta.fin) : null)
  const running =
    (status === 'READY' || status === 'RUNNING' || status === 'PAUSED') && !localCompleted

  const preparingMessage = isPreparing
    ? `Calculando simulacion hasta la fecha: ${formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)}`
    : null

  const displayStartDate = formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)

  const bannerMessage = (() => {
    if (status === 'COMPLETED') return 'Simulacion finalizada con exito.'
    if (status === 'FAILED') return statusMessage || 'La simulacion finalizo con error.'
    if (status === 'CLOSED') return statusMessage || 'Conexion finalizada.'
    if (localCompleted) return 'Simulacion finalizada: todas las aeronaves llegaron a destino.'
    return null
  })()

  const warehouseSnapshot = useMemo(() => {
    if (!meta?.almacenes || displayMinute === null) return {}
    const snapshot: Record<
      string,
      { capacidad: number; ocupacion: number; porcentaje: number; libre: number }
    > = {}
    meta.almacenes.forEach((almacen) => {
      let ocupacion = 0
      for (const evento of almacen.eventos) {
        if (evento.minuto > displayMinute) break
        ocupacion += evento.delta
      }
      const capacidad = almacen.capacidad || 1
      const libre = Math.max(0, capacidad - ocupacion)
      const porcentaje = (ocupacion * 100) / capacidad
      snapshot[almacen.codigoOaci] = { capacidad, ocupacion, porcentaje, libre }
    })
    return snapshot
  }, [meta, displayMinute])

  const airportsByCode = useMemo(() => {
    const map: Record<string, AirportDto> = {}
    airports.forEach((airport: AirportDto) => { // ✅ tipo explícito
      map[airport.codigoOaci] = airport
    })
    return map
  }, [airports])

  const activeSegments = useMemo(() => {
    if (displayMinute === null) return []
    return cappedSegments.filter(
      (seg) => displayMinute >= seg.salidaMin && displayMinute <= seg.llegadaMin
    )
  }, [cappedSegments, displayMinute])

  const stats = useMemo(() => {
    const totalSegments = cappedSegments.length
    const totalActive = activeSegments.length
    const totalCargo = activeSegments.reduce((acc, seg) => acc + seg.carga, 0)
    const totalCapacity = activeSegments.reduce((acc, seg) => acc + (seg.capacidad ?? 0), 0)
    const capacityPct = totalCapacity > 0 ? (totalCargo * 100) / totalCapacity : 0
    const avgDurationMin = activeSegments.length
      ? activeSegments.reduce((acc, seg) => acc + Math.max(0, seg.llegadaMin - seg.salidaMin), 0) /
        activeSegments.length
      : 0
    const progressPct =
      requestedStartMinute !== null && requestedEndMinute !== null && displayMinute !== null
        ? Math.min(
            100,
            Math.max(
              0,
              ((displayMinute - requestedStartMinute) * 100) /
                (requestedEndMinute - requestedStartMinute)
            )
          )
        : 0
    const activePct = totalSegments > 0 ? (totalActive * 100) / totalSegments : 0
    return {
      cards: [
        { label: 'Vuelos activos', value: `${totalActive}` },
        { label: 'Carga en aire', value: `${Math.round(totalCargo)}` },
        { label: 'Capacidad usada', value: `${capacityPct.toFixed(1)}%` },
        { label: 'Duracion prom. vuelo', value: `${(avgDurationMin / 60).toFixed(2)}h` },
      ],
      bars: [
        { label: 'Completado', value: progressPct },
        { label: 'Capacidad promedio', value: capacityPct },
        { label: 'Actividad de vuelos', value: activePct },
      ],
    }
  }, [activeSegments, cappedSegments, displayMinute, requestedStartMinute, requestedEndMinute])

  const warehouseItems = useMemo(() => {
    const entries = Object.entries(warehouseSnapshot).map(([codigo, data]) => {
      const airport = airportsByCode[codigo]
      const percent = data.porcentaje
      let color = '#54b86c'
      if (percent > ranges.amberMax) color = '#e36b60'
      else if (percent > ranges.greenMax) color = '#f0be62'
      return {
        codigoOaci: codigo,
        nombre: airport?.nombre ?? codigo,
        pais: airport?.pais ?? '--',
        porcentaje: percent,
        color,
      }
    })
    return entries.sort((a, b) => b.porcentaje - a.porcentaje)
  }, [warehouseSnapshot, airportsByCode, ranges])

  const handleSelectFlight = (flightId: number) => {
    setSelectedFlightId((prev: number | null) => (prev === flightId ? null : flightId)) // ✅ tipo explícito
  }

  const handleSelectAirport = (codigoOaci: string) => {
    setSelectedAirportCode((prev: string | null) => (prev === codigoOaci ? null : codigoOaci)) // ✅ tipo explícito
  }

  const handleRangesChange = (newRanges: { greenMax: number; amberMax: number }) => {
    setSimulation((prev) => ({ ...prev, ranges: newRanges }))
  }

  return (
    <>
      {!enviosKey ? (
        <UploadEnvios onUploaded={handleEnviosUploaded} />
      ) : (
        <>
            <section className={`toolbar ${isToolbarCollapsed ? 'collapsed' : ''}`}>
              <button 
                className="toggle-toolbar-btn" 
                onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
                title={isToolbarCollapsed ? "Expandir resumen" : "Colapsar resumen"}
              >
                {isToolbarCollapsed ? '▼' : '▲'}
              </button>
              
              {isToolbarCollapsed ? (
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1b3d6b' }}>
                  Resumen de la Simulación
                </div>
              ) : (
                <>
                  <div className="tabs">
                    <button className="tab active">Simulacion del periodo</button>
                    <button className="tab">Simulacion hasta el colapso</button>
                  </div>
                  <div className="status">
                    <div className="status-item">
                      Fecha: <strong>{displayStartDate}</strong>
                    </div>
                    <div className="status-item">
                      Duracion: <strong>{duration ? `${duration} dias` : '--'}</strong>
                    </div>
                    <div className="status-item">
                      Vuelos activos: <strong>{cappedSegments.length}</strong>
                    </div>
                    <div className="status-item">
                      Maletas: <strong>{meta?.totalMaletas ?? '--'}</strong>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className={`map-area ${isPanelCollapsed ? 'panel-collapsed' : ''}`}>
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
                selectedFlightId={selectedFlightId}
                selectedAirportCode={selectedAirportCode}
                selectedShipmentRoute={selectedShipmentRoute}
              />
              {isPreparing && <div className="prep-overlay">{preparingMessage}</div>}
              {bannerMessage && <div className="status-banner">{bannerMessage}</div>}
              {error && <div className="error">{error}</div>}
            </div>

            <SimulationControls
              onStart={handleStart}
              onPause={pause}
              onResume={resume}
              isRunning={running}
              isPaused={status === 'PAUSED'}
              ranges={ranges}
              onRangesChange={handleRangesChange}
              stats={stats}
              warehouseItems={warehouseItems}
              flightItems={activeSegments}
              selectedFlightId={selectedFlightId}
              onSelectFlight={handleSelectFlight}
              airportItems={airports.map((airport: AirportDto) => ({ // ✅ tipo explícito
                codigoOaci: airport.codigoOaci,
                nombre: airport.nombre,
                pais: airport.pais,
              }))}
              selectedAirportCode={selectedAirportCode}
              onSelectAirport={handleSelectAirport}
                isCollapsed={isPanelCollapsed}
                onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
                selectedShipmentRoute={selectedShipmentRoute}
                onSearchShipment={handleSearchShipment}
                shipmentSearchError={shipmentSearchError}
                sampleShipments={sampleShipments}
                currentMinute={displayMinute}
            />
          </section>
        </>
      )}
    </>
  )
}