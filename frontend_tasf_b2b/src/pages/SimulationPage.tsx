import { useEffect, useMemo, useState } from 'react' // ✅ useState importado
import type { AirportDto } from '../types/sim'
import { API_BASE, authFetch, fetchAirports, startSimulation } from '../services/api'
import MapView from '../components/MapView'
import SimulationStatus from '../components/SimulationStatus'
import SimulationControls from '../components/SimulationControls'
import UploadEnvios from '../components/UploadEnvios'
import { useSimulationContext } from '../contexts/SimulationContext'
import { DEFAULT_MAP_SEMAPHORE_FILTERS } from '../types/mapFilters'
import {
  filterAirportsByMapFilters,
  filterFlightSegmentsByMapFilters,
} from '../utils/mapFilters'
import { resolveSemaphoreColor } from '../utils/semaphore'

import {
  formatDurationHours,
  formatCompactDate,
  formatInteger,
  formatBags,
  formatPercent,
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

async function fetchShipmentRoute(
  simId: string,
  codigo: string
): Promise<RespuestaRutaEnvioDto> {
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments/${encodeURIComponent(codigo)}/route`
  )
  if (!res.ok) {
    throw new Error('No se pudo obtener la ruta del envío')
  }
  return res.json()
}

async function fetchSimulationShipments(simId: string, minute: number | null): Promise<string[]> {
  let url = `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments`
  if (minute !== null) {
    url += `?minute=${minute}`
  }
  const res = await authFetch(url)
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
  const [simulationMode, setSimulationMode] = useState<'period' | 'collapse'>('period')
  const [mapFilters, setMapFilters] = useState(DEFAULT_MAP_SEMAPHORE_FILTERS)

  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true)

  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState<RespuestaRutaEnvioDto | null>(null)
  const [shipmentSearchError, setShipmentSearchError] = useState<string | null>(null)
  const [sampleShipments, setSampleShipments] = useState<string[]>([])

  const {
    enviosKey,
    setEnviosKey,
    simulation,
    setSimulation,
    resetSimulation,
    status,
    statusMessage,
    currentMinute,
    segments,
    meta,
    pause,
    resume,
  } = useSimulationContext()

  const {
    simId,
    requestedStart,
    requestedDays,
    displayOffset,
    localCompleted,
    ranges,
  } = simulation

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
      requestedDays: simulationMode === 'period' ? dias : null,
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
      const payload: Parameters<typeof startSimulation>[0] =
        simulationMode === 'collapse'
          ? {
              envios: enviosKey,
              inicio: dateOnly,
              colapsoIncremental: true,
              bloqueDias: 5,
              intervaloPlanMs: 600000,
              maxEnvios: 5000000,
              poblacion: 50,
              generaciones: 10,
              reporte: false,
              paralelo: true,
              hilos: 6,
              estancamiento: 3,
              speedMinPerSec: 4,
            }
          : {
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
              speedMinPerSec: 4,
            }

      console.debug('[SimulationPage] startSimulation payload', {
        mode: simulationMode,
        payload,
      })

      const response = await startSimulation(payload)

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
      setSelectedFlightId(null)
      setSelectedAirportCode(null)
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

  const duration = simulationMode === 'collapse'
    ? 'Hasta colapso'
    : requestedDays ?? (meta ? getInclusiveDaySpan(meta.inicio, meta.fin) : null)
  const running =
    (status === 'READY' || status === 'RUNNING' || status === 'PAUSED') && !localCompleted

  const preparingMessage = isPreparing
    ? simulationMode === 'collapse'
      ? `Calculando simulacion hasta el colapso desde: ${formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)}`
      : `Calculando simulacion hasta la fecha: ${formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)}`
    : null

  const displayStartDate = formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)

  const bannerMessage = (() => {
    if (status === 'COMPLETED' && statusMessage) return statusMessage
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

  const activeSegments = useMemo(() => {
    if (displayMinute === null) return []
    return cappedSegments.filter(
      (seg) => displayMinute >= seg.salidaMin && displayMinute <= seg.llegadaMin
    )
  }, [cappedSegments, displayMinute])

  const mapSegments = useMemo(() => {
    return filterFlightSegmentsByMapFilters(
      localCompleted ? [] : cappedSegments,
      mapFilters,
      ranges
    )
  }, [cappedSegments, localCompleted, mapFilters, ranges])

  const mapAirports = useMemo(() => {
    return filterAirportsByMapFilters(airports, warehouseSnapshot, mapFilters, ranges)
  }, [airports, warehouseSnapshot, mapFilters, ranges])

  const mapFilterCounts = useMemo(() => ({
    flights: mapSegments.length,
    warehouses: mapAirports.length,
  }), [mapAirports.length, mapSegments.length])

  useEffect(() => {
    if (
      selectedFlightId !== null &&
      !mapSegments.some((segment) => segment.flightId === selectedFlightId)
    ) {
      setSelectedFlightId(null)
    }
  }, [mapSegments, selectedFlightId])

  useEffect(() => {
    if (
      selectedAirportCode !== null &&
      !mapAirports.some((airport) => airport.codigoOaci === selectedAirportCode)
    ) {
      setSelectedAirportCode(null)
    }
  }, [mapAirports, selectedAirportCode])

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
        { label: 'Vuelos activos', value: formatInteger(totalActive) },
        { label: 'Maletas en aire', value: formatBags(totalCargo) },
        { label: 'Capacidad usada', value: formatPercent(capacityPct) },
        { label: 'Duración prom. vuelo', value: formatDurationHours(avgDurationMin / 60, 2) },
      ],
      bars: [
        { label: 'Completado', value: progressPct },
        { label: 'Capacidad promedio', value: capacityPct },
        { label: 'Actividad de vuelos', value: activePct },
      ],
    }
  }, [activeSegments, cappedSegments, displayMinute, requestedStartMinute, requestedEndMinute])

  const airportItems = useMemo(() => {
    return airports.map((airport) => {
      const snapshot = warehouseSnapshot[airport.codigoOaci]
      const percent = snapshot?.porcentaje
      return {
        codigoOaci: airport.codigoOaci,
        nombre: airport.nombre,
        pais: airport.pais,
        capacidad: snapshot?.capacidad ?? airport.capacidad,
        ocupacion: snapshot?.ocupacion,
        porcentaje: percent,
        color: percent !== undefined ? resolveSemaphoreColor(percent, ranges).fill : undefined,
      }
    })
  }, [airports, warehouseSnapshot, ranges])

  const handleSelectFlight = (flightId: number) => {
    const nextFlightId = selectedFlightId === flightId ? null : flightId
    setSelectedFlightId(nextFlightId)
    if (nextFlightId !== null) {
      setSelectedAirportCode(null)
      setSelectedShipmentRoute(null)
      setShipmentSearchError(null)
    }
  }

  const handleSelectAirport = (codigoOaci: string) => {
    const nextAirportCode = selectedAirportCode === codigoOaci ? null : codigoOaci
    setSelectedAirportCode(nextAirportCode)
    if (nextAirportCode !== null) {
      setSelectedFlightId(null)
      setSelectedShipmentRoute(null)
      setShipmentSearchError(null)
    }
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
                    <button
                      className={`tab ${simulationMode === 'period' ? 'active' : ''}`}
                      onClick={() => setSimulationMode('period')}
                    >
                      Simulacion del periodo
                    </button>
                    <button
                      className={`tab ${simulationMode === 'collapse' ? 'active' : ''}`}
                      onClick={() => setSimulationMode('collapse')}
                    >
                      Simulacion hasta el colapso
                    </button>
                  </div>
                  <div className="status">
                    <div className="status-item">
                      Fecha: <strong>{displayStartDate}</strong>
                    </div>
                    <div className="status-item">
                      Duracion: <strong>{typeof duration === 'number' ? `${duration} dias` : duration}</strong>
                    </div>
                    <div className="status-item">
                      Vuelos activos: <strong>{formatInteger(cappedSegments.length)}</strong>
                    </div>
                    <div className="status-item">
                      Maletas: <strong>{formatInteger(meta?.totalMaletas)}</strong>
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
                airports={mapAirports}
                segments={mapSegments}
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
              mode={simulationMode}
              onStart={handleStart}
              onPause={pause}
              onResume={resume}
              isRunning={running}
              isPaused={status === 'PAUSED'}
              ranges={ranges}
              onRangesChange={handleRangesChange}
              mapFilters={mapFilters}
              onMapFiltersChange={setMapFilters}
              mapFilterCounts={mapFilterCounts}
              stats={stats}
              flightItems={activeSegments}
              selectedFlightId={selectedFlightId}
              onSelectFlight={handleSelectFlight}
              airportItems={airportItems}
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
