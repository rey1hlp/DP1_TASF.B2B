import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import type { AirportDto, FlightCrudDto } from '../types/sim'
import { API_BASE, authFetch, fetchAirports, listFlights, startSimulation } from '../services/api'
import MapView from '../components/MapView'
import SimulationControls from '../components/SimulationControls'
import UploadEnvios from '../components/UploadEnvios'
import type { AppLayoutContext } from '../layouts/AppLayout'
import { useSimulationContext } from '../contexts/SimulationContext'
import { DEFAULT_MAP_SEMAPHORE_FILTERS, type MapSemaphoreFilters } from '../types/mapFilters'
import type { EntityFocusRequest } from '../types/entityFocus'
import {
  filterAirportsByMapFilters,
  filterFlightSegmentsByMapFilters,
} from '../utils/mapFilters'
import { resolveSemaphoreColor } from '../utils/semaphore'
import FlightDetailPage from './FlightDetailPage'
import { buildCancelledFlightTraces, readCancelledFlightDays } from '../utils/cancelledFlightTraces'

import {
  formatDurationHours,
  formatClockFromMinute,
  formatCompactDate,
  formatDateFromDayIndex,
  formatDateTime,
  formatIsoDateFromDayIndex,
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
  const [airports, setAirports] = useState<AirportDto[]>([])
  const [flightCatalog, setFlightCatalog] = useState<FlightCrudDto[]>([])
  const [cancelledDays, setCancelledDays] = useState(() => readCancelledFlightDays())
  const [error, setError] = useState<string | null>(null)

  // 💾 UI States inicializados desde sessionStorage para recordar "dónde te quedaste"
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('sim_selected_flight')
    return saved ? Number(saved) : null
  })
  const [selectedAirportCode, setSelectedAirportCode] = useState<string | null>(() => {
    return sessionStorage.getItem('sim_selected_airport') || null
  })
  const [simulationMode, setSimulationMode] = useState<'period' | 'collapse'>(() => {
    return (sessionStorage.getItem('sim_mode') as 'period' | 'collapse') || 'period'
  })
  const [mapFilters, setMapFilters] = useState<MapSemaphoreFilters>(() => {
    const saved = sessionStorage.getItem('sim_map_filters')
    if (!saved) {
      return DEFAULT_MAP_SEMAPHORE_FILTERS
    }

    const parsed = JSON.parse(saved)
    return {
      ...DEFAULT_MAP_SEMAPHORE_FILTERS,
      ...parsed,
      flights: {
        ...DEFAULT_MAP_SEMAPHORE_FILTERS.flights,
        ...parsed?.flights,
        text: {
          ...DEFAULT_MAP_SEMAPHORE_FILTERS.flights.text,
          ...parsed?.flights?.text,
        },
      },
      warehouses: {
        ...DEFAULT_MAP_SEMAPHORE_FILTERS.warehouses,
        ...parsed?.warehouses,
      },
    }
  })
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('sim_panel_collapsed')
    // Si ya existe un registro lo usamos; de lo contrario por defecto empieza en true (cerrado)
    return saved ? saved === 'true' : true
  })

  const [fullDetailFlightId, setFullDetailFlightId] = useState<number | null>(null)

  // ⏱️ Estado para el cronómetro en tiempo real (en segundos)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  const { setTopbarMain } = useOutletContext<AppLayoutContext>()
  const navigate = useNavigate()

  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState<RespuestaRutaEnvioDto | null>(null)
  const [shipmentSearchError, setShipmentSearchError] = useState<string | null>(null)
  const [sampleShipments, setSampleShipments] = useState<string[]>([])
  const [entityFocusRequest, setEntityFocusRequest] = useState<EntityFocusRequest | null>(null)
  const entityFocusRequestIdRef = useRef(0)
  const [isStartingSimulation, setIsStartingSimulation] = useState(false)

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

  // ✅ Extraemos la validación fuera del useEffect
  // Debe reflejar lo mismo que "isPreparing" (READY o RUNNING cuentan como simulación activa),
  // pero en su forma "ya lista" (currentMinute !== null) en vez de "todavía calculando".
  const isActuallyMoving = (status === 'RUNNING' || status === 'READY') && currentMinute !== null;

  // ⏱️ Efecto que maneja el tic-tac del cronómetro real
  useEffect(() => {
    let cronometroInterval: ReturnType<typeof setInterval> | null = null

    if (isActuallyMoving) {
      // Como isActuallyMoving se mantiene en "true" aunque currentMinute cambie, 
      // este intervalo ya no se interrumpe y puede contar tranquilamente.
      cronometroInterval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else if (status === 'READY' || status === 'CLOSED') {
      setElapsedSeconds(0)
    }

    return () => {
      if (cronometroInterval) clearInterval(cronometroInterval)
    }
  }, [isActuallyMoving, status]) // ✅ Se añadió currentMinute para que reaccione al momento exacto en que termina de preparar

  // Función auxiliar interna para dar formato hh:mm:ss o mm:ss al cronómetro
  const formatCronometro = (totalSegundos: number): string => {
    const hrs = Math.floor(totalSegundos / 3600)
    const mins = Math.floor((totalSegundos % 3600) / 60)
    const secs = totalSegundos % 60

    const fMins = String(mins).padStart(2, '0')
    const fSecs = String(secs).padStart(2, '0')

    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${fMins}:${fSecs}`
    }
    return `${fMins}:${fSecs}`
  }

  // 💾 Efectos para guardar de forma reactiva el estado UI de la pantalla en la sesión activa
  useEffect(() => {
    sessionStorage.setItem('sim_mode', simulationMode)
  }, [simulationMode])

  useEffect(() => {
    sessionStorage.setItem('sim_map_filters', JSON.stringify(mapFilters))
  }, [mapFilters])

  useEffect(() => {
    if (selectedFlightId !== null) {
      sessionStorage.setItem('sim_selected_flight', String(selectedFlightId))
    } else {
      sessionStorage.removeItem('sim_selected_flight')
    }
  }, [selectedFlightId])

  useEffect(() => {
    if (selectedAirportCode !== null) {
      sessionStorage.setItem('sim_selected_airport', selectedAirportCode)
    } else {
      sessionStorage.removeItem('sim_selected_airport')
    }
  }, [selectedAirportCode])

  useEffect(() => {
    sessionStorage.setItem('sim_panel_collapsed', String(isPanelCollapsed))
  }, [isPanelCollapsed])


  useEffect(() => {
    setTopbarMain(
      <div className="topbar-simulation-mode" role="group" aria-label="Modo de simulación">
        <button
          type="button"
          className={`topbar-simulation-option ${simulationMode === 'period' ? 'active' : ''}`}
          onClick={() => setSimulationMode('period')}
        >
          Simulación del periodo
        </button>
        <button
          type="button"
          className={`topbar-simulation-option ${simulationMode === 'collapse' ? 'active' : ''}`}
          onClick={() => setSimulationMode('collapse')}
        >
          Hasta colapso
        </button>
      </div>
    )

    return () => setTopbarMain(null)
  }, [setTopbarMain, simulationMode])

  // Cargar aeropuertos una sola vez
  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    let cancelled = false

    listFlights(0, 1000, '')
      .then((result) => {
        if (!cancelled) {
          setFlightCatalog(result.content)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFlightCatalog([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const syncCancelledDays = () => {
      setCancelledDays(readCancelledFlightDays())
    }

    syncCancelledDays()
    window.addEventListener('tasf:cancelled-flight-days-updated', syncCancelledDays)
    window.addEventListener('storage', syncCancelledDays)

    return () => {
      window.removeEventListener('tasf:cancelled-flight-days-updated', syncCancelledDays)
      window.removeEventListener('storage', syncCancelledDays)
    }
  }, [])

  const handleEnviosUploaded = (key: string) => {
    setEnviosKey(key)
  }

  const handleStart = async ({ inicio, dias }: { inicio: string; dias: number }) => {
    setError(null)
    setIsStartingSimulation(true)
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
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })

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
      setIsStartingSimulation(false)
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

  const isPreparing = isStartingSimulation || ((status === 'READY' || status === 'RUNNING') && currentMinute === null)

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

  const simulatedDateKey =
    displayMinute === null ? null : formatIsoDateFromDayIndex(Math.floor(displayMinute / 1440))

  const cancelledFlightTraces = useMemo(() => {
    return buildCancelledFlightTraces(
      flightCatalog,
      airports,
      cancelledDays,
      simulatedDateKey,
      true,
    )
  }, [airports, cancelledDays, flightCatalog, simulatedDateKey])

  useEffect(() => {
    console.log('[SimulationPage] cancelled traces', {
      flightCatalog: flightCatalog.length,
      cancelledFlights: cancelledDays.length,
      cancelledFlightTraces: cancelledFlightTraces.length,
      simulatedDateKey,
    })
  }, [cancelledDays, cancelledFlightTraces.length, flightCatalog.length, simulatedDateKey])

  useEffect(() => {
    if (status === 'FAILED' || status === 'CLOSED') {
      setIsStartingSimulation(false)
      return
    }

    if (status === 'READY' && currentMinute !== null) {
      setIsStartingSimulation(false)
    }
  }, [status, currentMinute])

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

  const simulatedMapTimeLabel = (() => {
    if (!meta) {
      return 'Esperando simulación...'
    }
    if (preparingMessage) {
      return preparingMessage
    }
    if (status === 'PAUSED') {
      return 'Simulación pausada'
    }
    if (status === 'READY' && displayMinute === null) {
      return `Preparando simulación hasta ${formatCompactDate(meta.inicio)}...`
    }

    const minute = displayMinute ?? meta.diaMin * 1440
    const date = formatDateFromDayIndex(Math.floor(minute / 1440))
    const time = formatClockFromMinute(minute)
    return `Fecha simulada: ${date} - ${time}`
  })()

  const realMapTimeLabel = (() => {
    if (!meta || preparingMessage || (status === 'READY' && displayMinute === null)) {
      return null
    }

    return `Fecha actual: ${formatDateTime(new Date())}`
  })()

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

  const flightItems = useMemo(() => {
    return activeSegments.map((segment) => {
      const percent =
        segment.capacidad !== undefined && segment.capacidad > 0
          ? (segment.carga * 100) / segment.capacidad
          : undefined

      return {
        flightId: segment.flightId,
        origen: segment.origen,
        destino: segment.destino,
        salidaMin: segment.salidaMin,
        llegadaMin: segment.llegadaMin,
        carga: segment.carga,
        capacidad: segment.capacidad,
        porcentaje: percent,
        color: percent !== undefined ? resolveSemaphoreColor(percent, ranges).fill : undefined,
      }
    })
  }, [activeSegments, ranges])

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

  const handleMapAirportPreview = useCallback((codigoOaci: string | null) => {
    if (codigoOaci === null) {
      setSelectedAirportCode(null)
      return
    }

    setSelectedAirportCode(codigoOaci)
    setSelectedFlightId(null)
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
  }, [])

  const handleMapAirportDetailRequest = useCallback((codigoOaci: string) => {
    navigate(`/aeropuertos/${codigoOaci}/almacen`, {
      state: {
        from: 'simulation',
        simId,
        currentMinute: displayMinute,
        warehouseSnapshot,
      },
    })
  }, [navigate, simId, displayMinute, warehouseSnapshot])

  const handleMapFlightPreview = useCallback((flightId: number | null) => {
    if (flightId === null) {
      setSelectedFlightId(null)
      return
    }

    setSelectedFlightId(flightId)
    setSelectedAirportCode(null)
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
  }, [])

  const handleMapFlightDetailRequest = useCallback((flightId: number) => {
    entityFocusRequestIdRef.current += 1
    handleMapFlightPreview(flightId)
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'flight',
      id: flightId,
      requestId: entityFocusRequestIdRef.current,
    })

    setFullDetailFlightId(flightId)
  }, [handleMapFlightPreview])

  const handleRangesChange = (newRanges: { greenMax: number; amberMax: number }) => {
    setSimulation((prev) => ({ ...prev, ranges: newRanges }))
  }

  return (
    <>
      {!enviosKey ? (
        <UploadEnvios onUploaded={handleEnviosUploaded} />
      ) : fullDetailFlightId !== null ? (
        <FlightDetailPage
          flightId={fullDetailFlightId}
          isSimulation={true}
          simId={simId ?? undefined}
          simulationData={simulation}
          simulationFlight={(() => {
            const seg = segments.find(s => s.flightId === fullDetailFlightId);
            if (!seg) return undefined;
            return {
              flightId: seg.flightId,
              origen: seg.origen,
              destino: seg.destino,
              capacidad: seg.capacidad,
              salidaMin: seg.salidaMin,
              llegadaMin: seg.llegadaMin,
              ocupacion: seg.carga,
            };
          })()}
          onVolver={() => setFullDetailFlightId(null)}
        />
      ) : (
        <div className="simulation-page">
          <section className="toolbar simulation-summary-toolbar">
            <div className="status">
              <div className="status-item">
                Fecha: <strong>{displayStartDate}</strong>
              </div>
              <div className="status-item">
                Duración: <strong>{typeof duration === 'number' ? `${duration} días` : duration}</strong>
              </div>
              <div className="status-item">
                Vuelos activos: <strong>{formatInteger(cappedSegments.length)}</strong>
              </div>
              <div className="status-item">
                Maletas: <strong>{formatInteger(meta?.totalMaletas)}</strong>
              </div>
              <div className="status-item">
                Tiempo transcurrido: <strong style={{ color: '#0288d1' }}>{formatCronometro(elapsedSeconds)}</strong>
              </div>
            </div>
          </section>

          <section className={`map-area ${isPanelCollapsed ? 'panel-collapsed' : ''}`}>
            <div className="map-placeholder">
              <MapView
                airports={mapAirports}
                segments={mapSegments}
                currentMinute={displayMinute}
                timeLabel={simulatedMapTimeLabel}
                secondaryTimeLabel={realMapTimeLabel ?? undefined}
                cancelledFlightTraces={cancelledFlightTraces}
                warehouseSnapshot={warehouseSnapshot}
                ranges={ranges}
                selectedFlightId={selectedFlightId}
                selectedAirportCode={selectedAirportCode}
                selectedShipmentRoute={selectedShipmentRoute}
                onAirportPreview={handleMapAirportPreview}
                onAirportDetailRequest={handleMapAirportDetailRequest}
                onFlightPreview={handleMapFlightPreview}
                onFlightDetailRequest={handleMapFlightDetailRequest}
              />
              {isPreparing && <div className="prep-overlay">{preparingMessage ?? 'Calculando simulación...'}</div>}
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
              flightItems={flightItems}
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
              flightTextFilters={mapFilters.flights.text}
              onFlightTextFiltersChange={(filters) =>
                setMapFilters((current) => ({
                  ...current,
                  flights: {
                    ...current.flights,
                    text: filters,
                  },
                }))
              }
              currentMinute={displayMinute}
              entityFocusRequest={entityFocusRequest}
            />
          </section>
        </div>
      )}
    </>
  )
}
