import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router'
import type { AirportDto, EnvioDetalleDto, FlightCrudDto } from '../types/sim'
import {
  API_BASE,
  authFetch,
  createSimulationVirtualCancellation,
  fetchAirports,
  fetchCategorizedShipments,
  listFlights,
  startSimulation,
} from '../services/api'
import MapView from '../components/MapView'
import SimulationControls, { type ShipmentCategory } from '../components/SimulationControls'
import FlightCancellationPanel, { type CancellableFlightItem } from '../components/FlightCancellationPanel'
import SimulationPlaybackChip from '../components/SimulationPlaybackChip'
import UploadEnvios from '../components/UploadEnvios'
import type { AppLayoutContext } from '../layouts/AppLayout'
import { useSimulationContext } from '../contexts/SimulationContext'
import { DEFAULT_MAP_SEMAPHORE_FILTERS, type MapSemaphoreFilters } from '../types/mapFilters'
import type { EntityFocusRequest } from '../types/entityFocus'
import {
  buildAirportFlightTimings,
  filterAirportsByMapFilters,
  filterFlightSegmentsByMapFilters,
} from '../utils/mapFilters'
import { resolveAirportContinent } from '../utils/continents'
import { resolveSemaphoreColor, resolveSemaphoreLevel } from '../utils/semaphore'
import FlightDetailPage from './FlightDetailPage'
import { appendCancelledFlightDay, buildCancelledFlightTraces, readCancelledFlightDays } from '../utils/cancelledFlightTraces'
import SimulationReportModal from '../components/SimulationReportModal'
import { useAuth } from '../contexts/AuthContext'

import {
  formatDurationHours,
  formatCompactDate,
  formatDateTime,
  formatSimDateTimeFromMinuteWithGmt,
  formatElapsedReal,
  formatIsoDateFromDayIndex,
  formatInteger,
  formatBags,
  formatPercent,
  formatSimSpan,
  getDayIndexFromDateString,
  getInclusiveDaySpan,
} from '../utils/time'

export type PasoRutaDto = {
  vueloId: number | string
  planId?: number | null
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
}

export type ShipmentFilters = {
  origen: string;
};

export type RespuestaRutaEnvioDto = {
  codigoPedido: string
  codigoMaleta?: string
  numeroMaleta?: number
  totalMaletas?: number
  consultaMaleta?: boolean
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
  const { user } = useAuth()
  const [airports, setAirports] = useState<AirportDto[]>([])
  const [flightCatalog, setFlightCatalog] = useState<FlightCrudDto[]>([])
  const [cancelledDays, setCancelledDays] = useState(() => readCancelledFlightDays({ includeVirtual: false }))
  const [virtualCancelLoadingId, setVirtualCancelLoadingId] = useState<number | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
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
        text: {
          ...DEFAULT_MAP_SEMAPHORE_FILTERS.warehouses.text,
          ...parsed?.warehouses?.text,
        },
      },
    }
  })
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('sim_panel_collapsed')
    // Si ya existe un registro lo usamos; de lo contrario por defecto empieza en true (cerrado)
    return saved ? saved === 'true' : true
  })
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = sessionStorage.getItem('sim_panel_width')
    return saved ? parseInt(saved, 10) : 320
  })

  useEffect(() => {
    sessionStorage.setItem('sim_panel_width', panelWidth.toString())
  }, [panelWidth])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      setPanelWidth(Math.max(250, Math.min(800, startWidth + delta)))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'ew-resize'
  }

  const [fullDetailFlightId, setFullDetailFlightId] = useState<number | null>(null)

  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const { setTopbarMain } = useOutletContext<AppLayoutContext>()

  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState<RespuestaRutaEnvioDto | null>(null)
  const [shipmentSearchError, setShipmentSearchError] = useState<string | null>(null)
  const [sampleShipments, setSampleShipments] = useState<string[]>([])
  const [shipmentsPlanificados, setShipmentsPlanificados] = useState<EnvioDetalleDto[]>([])
  const [shipmentsEnVuelo, setShipmentsEnVuelo] = useState<EnvioDetalleDto[]>([])
  const [shipmentsEntregados, setShipmentsEntregados] = useState<EnvioDetalleDto[]>([])
  const [shipmentOriginFilter, setShipmentOriginFilter] = useState('')
  const [shipmentDestinationFilter, setShipmentDestinationFilter] = useState('')
  const [showCancelledDetails, setShowCancelledDetails] = useState(true)
  const [selectedShipmentCategory, setSelectedShipmentCategory] = useState<ShipmentCategory>(() => {
    const saved = sessionStorage.getItem('sim_shipment_category')
    return (saved as ShipmentCategory) || 'EN_VUELO'
  })
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
    setSpeed,
    elapsedSeconds,
    setElapsedSeconds,
  } = useSimulationContext()

  const speedBaseMinPerSec = meta?.speedMinPerSec && meta.speedMinPerSec > 0
    ? meta.speedMinPerSec
    : 4

  const {
    simId,
    requestedStart,
    requestedDays,
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
    sessionStorage.setItem('sim_shipment_category', selectedShipmentCategory)
  }, [selectedShipmentCategory])


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

  const airportGmtByCode = useMemo(
    () =>
      Object.fromEntries(
        airports.map((airport) => [airport.codigoOaci.toUpperCase(), airport.gmt]),
      ),
    [airports],
  )

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
      setCancelledDays(readCancelledFlightDays({ simulationId: simId ?? null }))
    }

    syncCancelledDays()
    window.addEventListener('tasf:cancelled-flight-days-updated', syncCancelledDays)
    window.addEventListener('storage', syncCancelledDays)

    return () => {
      window.removeEventListener('tasf:cancelled-flight-days-updated', syncCancelledDays)
      window.removeEventListener('storage', syncCancelledDays)
    }
  }, [simId])

  const handleEnviosUploaded = (key: string) => {
    setEnviosKey(key)
  }

  const handleStart = async ({ inicio, dias }: { inicio: string; dias: number }) => {
    setError(null)
    setIsStartingSimulation(true)
    setElapsedSeconds(0)
    setSimulation((prev) => (
      {
        ...prev,
        simId: null,
        requestedStart: inicio,
        requestedDays: simulationMode === 'period' ? dias : null,
        displayOffset: null,
        localCompleted: false,
      }
    ))
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
    setSampleShipments([])
    setShipmentsPlanificados([])
    setShipmentsEnVuelo([])
    setShipmentsEntregados([])
    setIsReportModalOpen(false)
    setPlaybackSpeed(1)

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
            inicioLocal: inicio,
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
            inicioLocal: inicio,
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

    // Toggle: si ya está seleccionado, deseleccionar
    if (selectedShipmentRoute?.codigoPedido === codigo) {
      setSelectedShipmentRoute(null)
      setEntityFocusRequest(null)
      return
    }

    try {
      setShipmentSearchError(null)
      const route = await fetchShipmentRoute(simId, codigo)
      setSelectedFlightId(null)
      setSelectedAirportCode(null)
      setSelectedShipmentRoute(route)
    } catch (err) {
      setSelectedShipmentRoute(null)
      setShipmentSearchError('No se encontro la ruta para la maleta o envio.')
    }
  }

  const loadShipmentRouteForEntityPanel = useCallback(async (codigo: string) => {
    if (!simId) return

    try {
      setShipmentSearchError(null)
      const route = await fetchShipmentRoute(simId, codigo)
      setSelectedShipmentRoute(route)
    } catch (err) {
      setSelectedShipmentRoute(null)
      setShipmentSearchError('No se encontro la ruta para la maleta o envio.')
    }
  }, [simId])

  const handleMapShipmentFocusRequest = useCallback((shipmentCode: string) => {
    entityFocusRequestIdRef.current += 1
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'shipment',
      id: shipmentCode,
      requestId: entityFocusRequestIdRef.current,
    })

    if (!shipmentCode || !simId) return
    void loadShipmentRouteForEntityPanel(shipmentCode)
  }, [loadShipmentRouteForEntityPanel, simId])

  const handleMapBagFocusRequest = useCallback((bagCode: string) => {
    entityFocusRequestIdRef.current += 1
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'bag',
      id: bagCode,
      requestId: entityFocusRequestIdRef.current,
    })

    if (!bagCode || !simId) return
    void loadShipmentRouteForEntityPanel(bagCode)
  }, [loadShipmentRouteForEntityPanel, simId])

  const handleClearShipmentRoute = useCallback(() => {
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
  }, [])

  const requestedStartOnlyDate = requestedStart ? requestedStart.substring(0, 10) : null
  const requestedStartIndex = requestedStartOnlyDate ? getDayIndexFromDateString(requestedStartOnlyDate) : null

  const requestedStartMinute = meta?.inicioUtcMinute ?? (requestedStartIndex !== null ? requestedStartIndex * 1440 : null)

  const requestedEndMinute =
    requestedStartMinute !== null && requestedDays !== null
      ? requestedStartMinute + requestedDays * 1440
      : null

  const isPreparing = isStartingSimulation || ((status === 'READY' || status === 'RUNNING') && currentMinute === null)

  const displayMinuteRaw = currentMinute

  // Extraemos el minuto truncado cada 15 minutos de la simulación (ej. 1440, 1455, 1470) para no saturar con consultas por segundo
  const simulatedQuarterMinute = displayMinuteRaw !== null ? Math.floor(displayMinuteRaw / 15) * 15 : null;

  // Obtener las muestras de envíos en tránsito
  useEffect(() => {
    if (simId && meta && (status === 'READY' || status === 'RUNNING' || status === 'COMPLETED' || status === 'PAUSED')) {
      fetchSimulationShipments(simId, simulatedQuarterMinute).then(setSampleShipments).catch(() => setSampleShipments([]))
    }
  }, [simId, meta, status, simulatedQuarterMinute])

  // Obtener los envíos categorizados (Planificados / En Vuelo / Entregados Recientes) según el minuto actual
  useEffect(() => {
    if (
      simId &&
      meta &&
      simulatedQuarterMinute !== null &&
      (status === 'READY' || status === 'RUNNING' || status === 'COMPLETED' || status === 'PAUSED')
    ) {
      fetchCategorizedShipments(simId, simulatedQuarterMinute)
        .then((data) => {
          setShipmentsPlanificados(data.planificados)
          setShipmentsEnVuelo(data.enVuelo)
          setShipmentsEntregados(data.entregadosRecientes)
        })
        .catch(() => {
          setShipmentsPlanificados([])
          setShipmentsEnVuelo([])
          setShipmentsEntregados([])
        })
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

  // Cuando se completa localmente, dejamos que el usuario vea el mapa final.
  // Ya no hacemos resetSimulation automático para no destruir el modal ni la vista.

  const displayMinute =
    localCompleted && requestedEndMinute !== null ? requestedEndMinute : displayMinuteRaw

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

  useEffect(() => {
    if (status === 'COMPLETED' || localCompleted) {
      setIsReportModalOpen(true)
    }
  }, [status, localCompleted])

  const duration = simulationMode === 'collapse'
    ? 'Hasta colapso'
    : requestedDays ?? (meta ? getInclusiveDaySpan(meta.inicio, meta.fin) : null)
  const running =
    (status === 'READY' || status === 'RUNNING' || status === 'PAUSED') && !localCompleted

  const preparingMessage = isPreparing
    ? simulationMode === 'collapse'
      ? `Calculando simulacion hasta el colapso desde: ${formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)}`
      : `Calculando simulacion desde la fecha: ${formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)}`
    : null

  const displayStartDate = formatCompactDate(requestedStartOnlyDate ?? meta?.inicio)

  const simulatedMapTimeLabel = (() => {
    if (!meta) {
      return 'Esperando simulación...'
    }
    if (preparingMessage) {
      return preparingMessage
    }
    if (status === 'READY' && displayMinute === null) {
      return `Preparando simulación hasta ${formatCompactDate(meta.inicio)}...`
    }

    const minute = displayMinute ?? meta.diaMin * 1440
    const userGmt = user?.airportCode ? airportGmtByCode[user.airportCode] ?? -5 : -5
    return formatSimDateTimeFromMinuteWithGmt(minute, userGmt)
  })()

  const simDurationMapLabel = (() => {
    if (!meta || preparingMessage || (status === 'READY' && displayMinute === null)) {
      return null
    }
    const minute = displayMinute ?? meta.diaMin * 1440
    const startMinute = requestedStartMinute ?? meta.diaMin * 1440
    const diff = Math.max(0, minute - startMinute)
    return formatSimSpan(diff)
  })()

  const realMapTimeLabel = (() => {
    if (!meta || preparingMessage || (status === 'READY' && displayMinute === null)) {
      return null
    }

    return formatDateTime(new Date())
  })()

  const realDurationMapLabel = (() => {
    if (!meta || preparingMessage || (status === 'READY' && displayMinute === null)) {
      return null
    }
    return formatElapsedReal(elapsedSeconds)
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

  const mapAirports = useMemo(() => {
    return filterAirportsByMapFilters(airports, warehouseSnapshot, mapFilters, ranges)
  }, [airports, warehouseSnapshot, mapFilters, ranges])

  const mapSegments = useMemo(() => {
    let baseFiltered = filterFlightSegmentsByMapFilters(
      localCompleted ? [] : cappedSegments,
      mapFilters,
      ranges
    )

    const shipOrig = shipmentOriginFilter.trim().toUpperCase()
    const shipDest = shipmentDestinationFilter.trim().toUpperCase()
    if (shipOrig) {
      baseFiltered = baseFiltered.filter(seg => seg.origen.toUpperCase().includes(shipOrig))
    }
    if (shipDest) {
      baseFiltered = baseFiltered.filter(seg => seg.destino.toUpperCase().includes(shipDest))
    }

    const airportCodes = new Set(mapAirports.map(a => a.codigoOaci))
    return baseFiltered.filter(seg => airportCodes.has(seg.origen) || airportCodes.has(seg.destino))
  }, [cappedSegments, localCompleted, mapFilters, ranges, mapAirports, shipmentOriginFilter, shipmentDestinationFilter])



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
    let totalWarehouseOcupacion = 0
    let totalWarehouseCapacidad = 0
    Object.values(warehouseSnapshot).forEach((w) => {
      totalWarehouseOcupacion += w.ocupacion
      totalWarehouseCapacidad += w.capacidad
    })
    const warehouseCapacityPct = totalWarehouseCapacidad > 0 ? (totalWarehouseOcupacion * 100) / totalWarehouseCapacidad : 0

    return {
      cards: [
        { label: 'Vuelos activos', value: formatInteger(totalActive) },
        { label: 'Maletas en aire', value: formatBags(totalCargo) },
        {
          label: 'Capacidad usada almacenes',
          value: formatPercent(warehouseCapacityPct),
          color: resolveSemaphoreColor(warehouseCapacityPct, ranges).fill,
          borderColor: resolveSemaphoreColor(warehouseCapacityPct, ranges).stroke,
          textColor: '#ffffff',
          labelColor: (() => {
            const l = resolveSemaphoreLevel(warehouseCapacityPct, ranges);
            return l === 'green' ? '#0f5223' : l === 'amber' ? '#734b00' : l === 'red' ? '#66140c' : '#5f6f8e';
          })(),
        },
        {
          label: 'Capacidad usada vuelos',
          value: formatPercent(capacityPct),
          color: resolveSemaphoreColor(capacityPct, ranges).fill,
          borderColor: resolveSemaphoreColor(capacityPct, ranges).stroke,
          textColor: '#ffffff',
          labelColor: (() => {
            const l = resolveSemaphoreLevel(capacityPct, ranges);
            return l === 'green' ? '#0f5223' : l === 'amber' ? '#734b00' : l === 'red' ? '#66140c' : '#5f6f8e';
          })(),
        },
        { label: 'Duración prom. vuelo', value: formatDurationHours(avgDurationMin / 60, 2) },
      ],
      bars: [
        { label: 'Completado', value: progressPct },
        { label: 'Capacidad promedio', value: capacityPct },
        { label: 'Actividad de vuelos', value: activePct },
      ],
    }
  }, [activeSegments, cappedSegments, displayMinute, requestedStartMinute, requestedEndMinute, ranges, warehouseSnapshot])

  const flightItems = useMemo(() => {
    return activeSegments.map((segment) => {
      const percent =
        segment.capacidad !== undefined && segment.capacidad > 0
          ? (segment.carga * 100) / segment.capacidad
          : undefined

      return {
        flightId: segment.flightId,
        planId: segment.planId,
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

  const virtualCancellationFlights = useMemo<CancellableFlightItem[]>(() => {
    if (displayMinute === null || !simulatedDateKey) {
      return []
    }

    const currentMinuteOfDay = Math.floor(displayMinute % 1440)
    const currentDayIndex = Math.floor(displayMinute / 1440)
    const byPlan = new Map<number, CancellableFlightItem>()

    for (const segment of cappedSegments) {
      if (segment.planId === null || segment.planId === undefined) {
        continue
      }
      if (segment.salidaMin <= displayMinute) {
        continue
      }
      if (byPlan.has(segment.planId)) {
        continue
      }

      const departureMinuteOfDay = Math.floor(segment.salidaMin % 1440)
      const cutoffMinute = departureMinuteOfDay - 60
      const effectiveDayIndex = currentMinuteOfDay > cutoffMinute ? currentDayIndex + 1 : currentDayIndex
      const effectiveDate = formatIsoDateFromDayIndex(effectiveDayIndex)
      const segmentDate = formatIsoDateFromDayIndex(Math.floor(segment.salidaMin / 1440))

      byPlan.set(segment.planId, {
        id: segment.planId,
        instanceId: segment.flightId,
        origen: segment.origen,
        destino: segment.destino,
        salidaMin: segment.salidaMin,
        llegadaMin: segment.llegadaMin,
        carga: segment.carga,
        capacidad: segment.capacidad,
        origenLat: segment.origenLat,
        origenLon: segment.origenLon,
        destinoLat: segment.destinoLat,
        destinoLon: segment.destinoLon,
        effectiveDate,
        effectiveNote: effectiveDate !== segmentDate
          ? 'Por la regla de 1 hora, esta cancelacion se aplicara a la siguiente ocurrencia del plan.'
          : 'La cancelacion se aplicara solo a esta fecha simulada.',
      })
    }

    return [...byPlan.values()].sort((a, b) => a.salidaMin - b.salidaMin).slice(0, 120)
  }, [cappedSegments, displayMinute, simulatedDateKey])

  const airportItems = useMemo(() => {
    const airportFlightTimings = buildAirportFlightTimings(cappedSegments, displayMinute)

    return airports.map((airport) => {
      const snapshot = warehouseSnapshot[airport.codigoOaci]
      const percent = snapshot?.porcentaje
      return {
        codigoOaci: airport.codigoOaci,
        nombre: airport.nombre,
        pais: airport.pais,
        continente: resolveAirportContinent(
          airport.continente,
          airport.latitud,
          airport.longitud,
        ),
        capacidad: snapshot?.capacidad ?? airport.capacidad,
        ocupacion: snapshot?.ocupacion,
        porcentaje: percent,
        nextDepartureMin: airportFlightTimings[airport.codigoOaci]?.nextDepartureMin,
        nextArrivalMin: airportFlightTimings[airport.codigoOaci]?.nextArrivalMin,
        color: percent !== undefined ? resolveSemaphoreColor(percent, ranges).fill : undefined,
      }
    })
  }, [airports, cappedSegments, displayMinute, warehouseSnapshot, ranges])

  // Filtramos en tiempo real las tres listas categorizadas según origen y destino
  const filterShipmentsByOriginDestino = useCallback(
    (items: EnvioDetalleDto[]) => {
      const originQuery = shipmentOriginFilter.trim().toLowerCase()
      const destinoQuery = shipmentDestinationFilter.trim().toLowerCase()

      return items.filter((item) => {
        const matchesOrigin = !originQuery || (item.origen ?? '').toLowerCase().includes(originQuery)
        const matchesDestino = !destinoQuery || (item.destino ?? '').toLowerCase().includes(destinoQuery)
        return matchesOrigin && matchesDestino
      })
    },
    [shipmentOriginFilter, shipmentDestinationFilter]
  )

  const filteredShipmentsPlanificados = useMemo(
    () => filterShipmentsByOriginDestino(shipmentsPlanificados),
    [filterShipmentsByOriginDestino, shipmentsPlanificados]
  )
  const filteredShipmentsEnVuelo = useMemo(
    () => filterShipmentsByOriginDestino(shipmentsEnVuelo),
    [filterShipmentsByOriginDestino, shipmentsEnVuelo]
  )
  const filteredShipmentsEntregados = useMemo(
    () => filterShipmentsByOriginDestino(shipmentsEntregados),
    [filterShipmentsByOriginDestino, shipmentsEntregados]
  )
  const shipmentQuantities = useMemo(() => {
    const entries = [
      ...shipmentsPlanificados,
      ...shipmentsEnVuelo,
      ...shipmentsEntregados,
    ].map((shipment) => [shipment.codigoPedido, shipment.cantidadMaletas] as const)

    return Object.fromEntries(entries)
  }, [shipmentsEntregados, shipmentsEnVuelo, shipmentsPlanificados])

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

    entityFocusRequestIdRef.current += 1
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'airport',
      id: codigoOaci,
      requestId: entityFocusRequestIdRef.current,
    })
  }, [])

  const handleMapFlightPreview = useCallback((flightId: number | null) => {
    if (flightId === null) {
      setSelectedFlightId(null)
      return
    }

    setSelectedFlightId(flightId)
    setSelectedAirportCode(null)
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)

    entityFocusRequestIdRef.current += 1
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'flight',
      id: flightId,
      requestId: entityFocusRequestIdRef.current,
    })
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

  const handlePlaybackSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed)
    setSpeed(speedBaseMinPerSec * speed)
  }, [setSpeed, speedBaseMinPerSec])

  const handleVirtualCancelFlight = useCallback(async (flight: CancellableFlightItem, reason: string) => {
    if (!simId || displayMinute === null || !simulatedDateKey) {
      setError('La simulacion debe estar activa para registrar una cancelacion virtual.')
      return
    }

    setVirtualCancelLoadingId(flight.id)
    setError(null)
    try {
      const contextMinuteOfDay = Math.floor(displayMinute % 1440)
      const saved = await createSimulationVirtualCancellation(simId, flight.id, {
        fecha: simulatedDateKey,
        contextDate: simulatedDateKey,
        contextMinuteOfDay,
        reason,
      })

      const effectiveDate = saved.fechaCancelacion?.slice(0, 10) ?? flight.effectiveDate ?? simulatedDateKey
      const departureMinuteOfDay = Math.floor(flight.salidaMin % 1440)
      const duration = Math.max(0, flight.llegadaMin - flight.salidaMin)

      appendCancelledFlightDay({
        flightId: flight.id,
        fecha: effectiveDate,
        sourceType: 'VIRTUAL',
        simulationId: simId,
        origen: flight.origen,
        destino: flight.destino,
        origenLat: flight.origenLat ?? undefined,
        origenLon: flight.origenLon ?? undefined,
        destinoLat: flight.destinoLat ?? undefined,
        destinoLon: flight.destinoLon ?? undefined,
        salidaMin: departureMinuteOfDay,
        llegadaMin: departureMinuteOfDay + duration,
      })
      setCancelledDays(readCancelledFlightDays({ simulationId: simId ?? null }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la cancelacion virtual'
      setError(msg)
    } finally {
      setVirtualCancelLoadingId(null)
    }
  }, [displayMinute, simId, simulatedDateKey])

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
              planId: seg.planId,
              codigo: seg.codigo,
              origen: seg.origen,
              destino: seg.destino,
              capacidad: seg.capacidad,
              salidaMin: seg.salidaMin,
              llegadaMin: seg.llegadaMin,
              ocupacion: seg.carga,
              origenGmt: airportGmtByCode[seg.origen] ?? 0,
              destinoGmt: airportGmtByCode[seg.destino] ?? 0,
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

          <section
            className={`map-area ${isPanelCollapsed ? 'panel-collapsed' : ''} ${isMapFullscreen ? 'is-fullscreen' : ''}`}
            style={{ '--panel-width': `${panelWidth}px` } as React.CSSProperties}
          >
            <div className="map-placeholder">
              <SimulationPlaybackChip
                isPaused={status === 'PAUSED'}
                isDisabled={!running || isPreparing}
                speed={playbackSpeed}
                onPause={pause}
                onResume={resume}
                onSpeedChange={handlePlaybackSpeedChange}
              />
              <MapView
                isSimulation={true}
                airports={mapAirports}
                segments={mapSegments}
                currentMinute={displayMinute}
                timeLabel={simulatedMapTimeLabel}
                simDurationLabel={simDurationMapLabel ?? undefined}
                secondaryTimeLabel={realMapTimeLabel ?? undefined}
                realDurationLabel={realDurationMapLabel ?? undefined}
                isPaused={status === 'PAUSED'}
                cancelledFlightTraces={cancelledFlightTraces}
                warehouseSnapshot={warehouseSnapshot}
                ranges={ranges}
                mapFilters={mapFilters}
                onMapFiltersChange={setMapFilters}
                selectedFlightId={selectedFlightId}
                selectedAirportCode={selectedAirportCode}
                selectedShipmentRoute={selectedShipmentRoute}
                shipmentSearchError={shipmentSearchError}
                isFullscreen={isMapFullscreen}
                isPanelCollapsed={isPanelCollapsed}
                onToggleFullscreen={() => setIsMapFullscreen((current) => !current)}
                onShipmentFocusRequest={handleMapShipmentFocusRequest}
                onBagFocusRequest={handleMapBagFocusRequest}
                onClearShipmentRoute={handleClearShipmentRoute}
                onAirportPreview={handleMapAirportPreview}
                onFlightPreview={handleMapFlightPreview}
                onFlightDetailRequest={handleMapFlightDetailRequest}
                showCancelledDetails={showCancelledDetails}
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
              airportGmtByCode={airportGmtByCode}
              selectedAirportCode={selectedAirportCode}
              onSelectAirport={handleSelectAirport}
              isCollapsed={isPanelCollapsed}
              onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
              onResizeStart={handleResizeStart}
              selectedShipmentRoute={selectedShipmentRoute}
              onSearchShipment={handleSearchShipment}
              onSelectShipmentRoute={setSelectedShipmentRoute}
              shipmentSearchError={shipmentSearchError}
              sampleShipments={sampleShipments}
              shipmentQuantities={shipmentQuantities}
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
              airportTextFilters={mapFilters.warehouses.text}
              onAirportTextFiltersChange={(filters) =>
                setMapFilters((current) => ({
                  ...current,
                  warehouses: {
                    ...current.warehouses,
                    text: filters,
                  },
                }))
              }
              currentMinute={displayMinute}
              entityFocusRequest={entityFocusRequest}
              shipmentsPlanificados={filteredShipmentsPlanificados}
              shipmentsEnVuelo={filteredShipmentsEnVuelo}
              shipmentsEntregados={filteredShipmentsEntregados}
              shipmentOriginFilter={shipmentOriginFilter}
              onShipmentOriginFilterChange={setShipmentOriginFilter}
              shipmentDestinationFilter={shipmentDestinationFilter}
              onShipmentDestinationFilterChange={setShipmentDestinationFilter}
              selectedShipmentCategory={selectedShipmentCategory}
              onSelectedShipmentCategoryChange={setSelectedShipmentCategory}
              showCancelledDetails={showCancelledDetails}
              onShowCancelledDetailsChange={setShowCancelledDetails}
              flightCancellationPanel={
                <FlightCancellationPanel
                  title="Cancelaciones simuladas"
                  description="Registra indisponibilidades virtuales para recalcular esta simulacion sin afectar la operacion real."
                  flights={virtualCancellationFlights}
                  disabled={!simId || displayMinute === null || status === 'RUNNING'}
                  loadingFlightId={virtualCancelLoadingId}
                  emptyMessage="Inicia la simulacion para ver los proximos planes de vuelo cancelables."
                  submitLabel="Cancelar en simulacion"
                  onCancel={handleVirtualCancelFlight}
                />
              }
            />
          </section>

          <SimulationReportModal
            isOpen={isReportModalOpen}
            simId={simId}
            onClose={() => {
              setIsReportModalOpen(false)
              if (localCompleted || status === 'COMPLETED') {
                setElapsedSeconds(0)
                resetSimulation()
              }
            }}
            mode={simulationMode}
            meta={meta}
            statusMessage={statusMessage}
            stats={stats}
          />
        </div>
      )}
    </>
  )
}
