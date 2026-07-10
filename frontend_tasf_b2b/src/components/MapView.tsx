import { useEffect, useMemo, useRef, useState } from 'react'
// [NUEVO] Importamos el tipo de GeoJSON de TypeScript para tipar correctamente el estado del continente.
// Si no tienes @types/geojson instalado, ejecuta: npm install -D @types/geojson
import L from 'leaflet'
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk'
import { Calendar, CalendarClock, Maximize2, Minimize2, PlayCircle, RotateCcw, Settings, Timer, X, type LucideIcon } from 'lucide-react'
import type { AirportDto, FlightSegmentDto, ShipmentCrudDto } from '../types/sim'
import {
  API_BASE,
  authFetch,
  getAirportShipments,
  getShipmentByCode,
  getShipmentsByFlight,
  getSimulationShipmentsByFlight,
} from '../services/api'
import { useSimulationContext } from '../contexts/SimulationContext'
import { formatBags, formatDurationHours, formatInteger, formatMinuteRange, formatPercent, formatDateFromDayIndex, formatClockFromMinute } from '../utils/time'
import {
  NEUTRAL_SEMAPHORE_COLORS,
  resolveSemaphoreColor,
  resolveSemaphoreLevel,
} from '../utils/semaphore'
import {
  ALL_FLIGHTS_ROUTE_BASE_STYLE,
  CANCELLED_ROUTE_STYLE,
  GHOST_FADE_DURATION_MS,
  GHOST_ROUTE_STYLE,
  LANDED_ROUTE_STYLE,
  MAP_PANES,
  SELECTED_ROUTE_STYLE,
  SHIPMENT_ROUTE_ACTIVE_STYLE,
  SHIPMENT_ROUTE_DONE_STYLE,
  SHIPMENT_ROUTE_PENDING_STYLE,
} from '../utils/mapRouteStyles'
import { buildGeodesicArcPoints, getGeodesicPointAtProgress, type MapLatLng } from '../utils/mapGeodesic'
import MapFloatingCard from './MapFloatingCard'
import ShipmentRouteTracker, { type TrackerShipmentRoute } from './ShipmentRouteTracker'
import useMapSelectionFocus from '../hooks/useMapSelectionFocus'
import type { CancelledFlightTrace } from '../utils/cancelledFlightTraces'

type FlightDetailsStage = 'flight' | 'shipments' | 'shipmentDetails'
type AirportDetailsStage = 'airport' | 'shipments' | 'shipmentDetails'

type TimeChipTone = 'simulated' | 'real'

type TimeChipProps = {
  icon: LucideIcon
  label: string
  value: string
  tone: TimeChipTone
  onClose: () => void
}

function MapTimeChip({ icon: Icon, label, value, tone, onClose }: TimeChipProps) {
  return (
    <div className={`map-time-tab-container map-time-tab-container--${tone}`}>
      <div className={`map-time-tab map-time-tab--${tone}`}>
        <Icon className="map-time-tab-icon" size={16} strokeWidth={2} />
        <span className="map-time-tab-text">
          <span className="map-time-tab-label">{label}</span>
          <span className="map-time-tab-value">{value}</span>
        </span>
      </div>
      <button
        className="map-time-tab-close"
        onClick={onClose}
        title="Ocultar"
      >
        <X size={12} />
      </button>
    </div>
  )
}

const PLANE_PATH =
  "M 17.8 19.2 L 16 11 l 3.5 -3.5 C 21 6 21.5 4 21 3 c -1 -0.5 -3 0 -4.5 1.5 L 13 8 L 4.8 6.2 c -0.5 -0.1 -0.9 0.1 -1.1 0.5 l -0.3 0.5 c -0.2 0.5 -0.1 1 0.3 1.3 L 9 12 l -2 3 H 4 l -1 1 l 3 2 l 2 3 l 1 -1 v -3 l 3 -2 l 3.5 5.3 c 0.3 0.4 0.8 0.5 1.3 0.3 l 0.5 -0.2 c 0.4 -0.3 0.6 -0.7 0.5 -1.2 Z"

// Ícono profesional de "Avión Despegando / Aeropuerto"
const AIRPORT_PATHS = [
  "M18.2 12.27 20 6H4l1.8 6.27a1 1 0 0 0 .95.73h10.5a1 1 0 0 0 .96-.73Z",
  "M8 13v9",
  "M16 22v-9",
  "m9 6 1 7",
  "m15 6-1 7",
  "M12 6V2",
  "M13 2h-2",
]

export type MapViewProps = {
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
  warehouseSnapshot: Record<string, { capacidad: number; ocupacion: number; porcentaje: number; libre: number }>
  ranges: { greenMax: number; amberMax: number }
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute?: TrackerShipmentRoute | null
  shipmentSearchError?: string | null
  isFullscreen: boolean
  isPanelCollapsed?: boolean
  isToolbarCollapsed?: boolean
  timeLabel?: string
  simDurationLabel?: string
  secondaryTimeLabel?: string
  realDurationLabel?: string
  isPaused?: boolean
  cancelledFlightTraces?: CancelledFlightTrace[]
  // [NUEVO] Continente seleccionado desde los filtros externos.
  // Puede ser un nombre de continente (ej. 'South America'), 'ALL' para mostrar todos, o null para ninguno.
  selectedContinent?: string | null
  onAirportDetailRequest?: (codigoOaci: string) => void
  onAirportPreview?: (codigoOaci: string | null) => void
  onFlightDetailRequest?: (flightId: number) => void
  onFlightPreview?: (flightId: number | null) => void
  onSearchShipment?: (codigo: string) => void | Promise<void>
  onClearShipmentRoute?: () => void
  onToggleFullscreen: () => void
  showCancelledDetails?: boolean
}

const DEFAULT_CENTER: [number, number] = [12, -10]
const DEFAULT_ZOOM = 2
const YOUR_API_KEY = 'cs78LhJcqA5P4sFbhTaG';
const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/019f2fff-a937-7733-b3ff-b0ebc2406d84/style.json`
const SELECTED_AIRPORT_COLORS = {
  stroke: '#2f62b5',
  fill: '#d7e5fb',
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const delta = toRad(lon2 - lon1)
  const y = Math.sin(delta) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta)
  const bearing = Math.atan2(y, x)
  return (bearing * 180) / Math.PI
}

function buildRouteArc(startLat: number, startLon: number, endLat: number, endLon: number): MapLatLng[] {
  return buildGeodesicArcPoints([startLat, startLon], [endLat, endLon])
}

function unwrapLongitudeForProjection(longitude: number, reference: number) {
  let adjusted = longitude

  while (adjusted - reference > 180) {
    adjusted -= 360
  }

  while (adjusted - reference < -180) {
    adjusted += 360
  }

  return adjusted
}

function computeMapHeading(map: L.Map, from: MapLatLng, to: MapLatLng) {
  const [fromLat, fromLon] = from
  const [toLat, toLon] = to
  const adjustedToLon = unwrapLongitudeForProjection(toLon, fromLon)
  const p1 = map.project([fromLat, fromLon], 10)
  const p2 = map.project([toLat, adjustedToLon], 10)
  const dy = p1.y - p2.y
  const dx = p2.x - p1.x
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

function getFlightArcPosition(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  progress: number,
  map: L.Map | null
) {
  const start: MapLatLng = [startLat, startLon]
  const end: MapLatLng = [endLat, endLon]
  const current = getGeodesicPointAtProgress(start, end, progress)
  const lookDelta = 0.01
  const lookAheadProgress = Math.min(1, progress + lookDelta)
  const lookBehindProgress = Math.max(0, progress - lookDelta)
  const reference =
    lookAheadProgress > progress
      ? getGeodesicPointAtProgress(start, end, lookAheadProgress)
      : getGeodesicPointAtProgress(start, end, lookBehindProgress)

  const heading = map
    ? computeMapHeading(map, current, reference)
    : computeBearing(current[0], current[1], reference[0], reference[1])

  return {
    lat: current[0],
    lon: current[1],
    heading,
  }
}

function buildPlaneIcon(
  heading: number,
  carga: number,
  capacidad: number | undefined,
  ranges: { greenMax: number; amberMax: number },
  dimmed = false,
  isSelected = false,
) {
  // está dibujado apuntando en diagonal (hacia arriba a la derecha).
  const rotation = heading - 45

  const percent =
    capacidad !== undefined && capacidad > 0
      ? (carga / capacidad) * 100
      : null

  const colors = isSelected
    ? SELECTED_AIRPORT_COLORS
    : percent === null
      ? NEUTRAL_SEMAPHORE_COLORS
      : resolveSemaphoreColor(percent, ranges)

  const isEmpty = carga === 0
  const fill = isEmpty && !isSelected ? 'none' : colors.fill
  const stroke = colors.stroke
  const strokeWidth = isSelected ? 2.1 : isEmpty ? 1.8 : 1.5

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="${PLANE_PATH}"/>
  </svg>`

  return L.divIcon({
    className: 'plane-marker',
    html: `<div class="plane-marker-hitbox"><div style="transform:rotate(${rotation}deg);width:28px;height:28px;opacity:${dimmed ? 0.4 : 1}">${svg}</div></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

function buildAirportIcon(
  colors: { stroke: string; fill: string },
  isSelected: boolean
) {
  const markerSize = isSelected ? 42 : 34
  const iconSize = isSelected ? 22 : 20
  const displayColors = isSelected ? SELECTED_AIRPORT_COLORS : colors

  const svgPaths = AIRPORT_PATHS.map(path => `<path d="${path}"/>`).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
    fill="none" stroke="${displayColors.stroke}" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    ${svgPaths}
  </svg>`

  return L.divIcon({
    className: 'airport-marker',
    html: `<div style="
      width:${markerSize}px;
      height:${markerSize}px;
      border-radius:999px;
      background:#ffffff;
      border:1px solid rgba(15, 23, 42, 0.18);
      display:grid;
      place-items:center;
      box-shadow:0 2px 7px rgba(15, 23, 42, 0.25);
    ">${svg}</div>`,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  })
}

function getShipmentStepStyle(
  step: { salidaMin: number; llegadaMin: number },
  currentMinute: number | null
) {
  if (currentMinute == null) {
    return SHIPMENT_ROUTE_PENDING_STYLE
  }
  if (currentMinute >= step.salidaMin && currentMinute <= step.llegadaMin) {
    return SHIPMENT_ROUTE_ACTIVE_STYLE
  }
  if (currentMinute > step.llegadaMin) {
    return SHIPMENT_ROUTE_DONE_STYLE
  }
  return SHIPMENT_ROUTE_PENDING_STYLE
}

function buildShipmentBagCodes(codigoPedido: string, cantidad?: number) {
  const total = Math.max(0, Math.floor(cantidad ?? 0))
  return Array.from({ length: total }, (_, index) => `${codigoPedido}-${String(index + 1).padStart(3, '0')}`)
}

export default function MapView({
  airports,
  segments,
  currentMinute,
  warehouseSnapshot,
  ranges,
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentRoute,
  shipmentSearchError,
  isFullscreen,
  isPanelCollapsed = false,
  isToolbarCollapsed = false,
  timeLabel,
  simDurationLabel,
  secondaryTimeLabel,
  realDurationLabel,
  isPaused = false,
  cancelledFlightTraces,
  // [NUEVO] Prop recibida desde el padre con el continente activo en los filtros.
  selectedContinent,
  onAirportDetailRequest,
  onAirportPreview,
  onFlightDetailRequest,
  onFlightPreview,
  onSearchShipment,
  onClearShipmentRoute,
  onToggleFullscreen,
  showCancelledDetails = true,
}: MapViewProps) {
  const { simulation } = useSimulationContext()
  const simId = simulation.simId
  const mapRef = useRef<L.Map | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [previewAirportCode, setPreviewAirportCode] = useState<string | null>(null)
  const [previewFlightId, setPreviewFlightId] = useState<number | null>(null)
  const [detailStage, setDetailStage] = useState<FlightDetailsStage>('flight')
  const [airportDetailStage, setAirportDetailStage] = useState<AirportDetailsStage>('airport')
  const [flightShipments, setFlightShipments] = useState<ShipmentCrudDto[]>([])
  const [flightShipmentsLoading, setFlightShipmentsLoading] = useState(false)
  const [flightShipmentsError, setFlightShipmentsError] = useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<ShipmentCrudDto | null>(null)
  const [airportShipments, setAirportShipments] = useState<ShipmentCrudDto[]>([])
  const [shipmentFilterType, setShipmentFilterType] = useState<'all' | 'entrante' | 'saliente'>('all')
  const [airportShipmentsLoading, setAirportShipmentsLoading] = useState(false)
  const [airportShipmentsError, setAirportShipmentsError] = useState<string | null>(null)
  const [selectedAirportShipment, setSelectedAirportShipment] = useState<ShipmentCrudDto | null>(null)
  const [trackerCode, setTrackerCode] = useState<string | null>(null)
  const [isTrackerOpen, setIsTrackerOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [visibleTimeItems, setVisibleTimeItems] = useState({
    simulatedDate: true,
    simulatedDuration: true,
    actualDate: true,
    actualDuration: true,
  })
  const airportLayerRef = useRef<L.LayerGroup | null>(null)
  const planeLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const cancelledRouteLayerRef = useRef<L.LayerGroup | null>(null)
  const ghostLayerRef = useRef<L.LayerGroup | null>(null)
  // [NUEVO] Ref para la capa GeoJSON del continente seleccionado.
  // Guardamos la referencia para poder limpiarla/reemplazarla al cambiar de continente.
  const continentLayerRef = useRef<L.GeoJSON | null>(null)
  const planeMarkersRef = useRef<Map<number, L.Marker>>(new Map())
  // 👻 Memoria temporal de vuelos recién aterrizados (para el efecto "fantasma")
  const prevSegmentsMapRef = useRef<Map<number, FlightSegmentDto>>(new Map())
  const landedGhostsRef = useRef<Map<number, { polyline: L.Polyline; startedAt: number }>>(new Map())
  const resizeFrameRef = useRef<number | null>(null)
  const resizeTimerRef = useRef<number | null>(null)
  const closedPreviewAirportCodeRef = useRef<string | null>(null)
  const closedPreviewFlightIdRef = useRef<number | null>(null)
  const lastAirportCodeRef = useRef<string | null>(null)
  const cancelledFlightIdSet = useMemo(
    () => new Set((cancelledFlightTraces ?? []).map((trace) => trace.flightId)),
    [cancelledFlightTraces],
  )

  // [NUEVO] Filtra el archivo continents.json para extraer solo el/los feature(s) que coincidan
  // con el continente seleccionado. Retorna null si no hay selección activa o si es 'ALL'.
  //
  // IMPORTANTE: este hook asume que tienes un archivo en tu proyecto en:
  //   src/data/continents.json  (o la ruta que uses en tu proyecto)
  // con la estructura GeoJSON estándar donde cada feature tiene:
  //   feature.properties.CONTINENT  (string con el nombre del continente en inglés)
  //
  // Ejemplo de uso del import estático (recomendado con Vite/Webpack):
  //   import continentsData from '../data/continents.json'
  // y luego pasarlo como parámetro al useMemo.
  //
  // Aquí el dato se importa dinámicamente para que el módulo sea autocontenido,
  // pero puedes cambiar a import estático si tu bundler lo soporta.
  const [continentsGeoJSON, setContinentsGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null)

  useEffect(() => {
    // Carga el archivo GeoJSON una sola vez al montar el componente.
    // Ajusta la ruta según dónde coloques tu archivo continents.json.
    import('../data/continents.json')
      .then((module) => {
        setContinentsGeoJSON(module.default as GeoJSON.FeatureCollection)
      })
      .catch((err) => {
        console.warn('[MapView] No se pudo cargar continents.json:', err)
      })
  }, [])

  // Filtra los features del GeoJSON para obtener solo el polígono del continente activo.
  // Devuelve null cuando:
  //   - No hay dato cargado todavía
  //   - selectedContinent es null o 'ALL' (sin resaltado)
  const continentFeatureCollection = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!continentsGeoJSON || !selectedContinent || selectedContinent === 'ALL') {
      return null
    }

    const matchingFeatures = continentsGeoJSON.features.filter(
      (feature) =>
        feature.properties?.CONTINENT?.toLowerCase() === selectedContinent.toLowerCase()
    )

    if (matchingFeatures.length === 0) {
      return null
    }

    // Devolvemos un FeatureCollection válido con solo los features del continente elegido.
    return {
      type: 'FeatureCollection',
      features: matchingFeatures,
    }
  }, [continentsGeoJSON, selectedContinent])

  useEffect(() => {
    if (!selectedShipmentRoute?.consultaMaleta || !selectedShipmentRoute.codigoMaleta) {
      return
    }

    setTrackerCode(selectedShipmentRoute.codigoMaleta)
    setIsTrackerOpen(true)
  }, [selectedShipmentRoute?.codigoMaleta, selectedShipmentRoute?.consultaMaleta])

  const previewAirport = useMemo(() => {
    if (previewAirportCode === null) {
      return null
    }
    return airports.find((airport) => airport.codigoOaci === previewAirportCode) ?? null
  }, [airports, previewAirportCode])

  const previewFlight = useMemo(() => {
    if (previewFlightId === null) {
      return null
    }
    return segments.find((segment) => segment.flightId === previewFlightId) ?? null
  }, [segments, previewFlightId])

  useEffect(() => {
    setDetailStage('flight')
    setFlightShipments([])
    setFlightShipmentsError(null)
    setSelectedShipment(null)
    setFlightShipmentsLoading(false)
  }, [previewFlightId])

  useEffect(() => {
    setAirportDetailStage('airport')
    setAirportShipments([])
    setAirportShipmentsError(null)
    setSelectedAirportShipment(null)
    setAirportShipmentsLoading(false)
  }, [previewAirportCode])

  useEffect(() => {
    if (detailStage !== 'shipments' || previewFlightId === null) {
      return
    }

    let cancelled = false
    const activeFlightId = previewFlight?.flightId ?? previewFlightId
    type ShipmentRoute = {
      codigoPedido: string
      estado: string
      tiempoTotalHoras: number
      ruta: Array<{ vueloId: number | string }>
    }

    const buildFallbackShipments = async () => {
      if (!simId || !previewFlight) {
        return []
      }

      const startMinute = Math.max(0, Math.floor(previewFlight.salidaMin))
      const endMinute = Math.max(startMinute, Math.floor(previewFlight.llegadaMin))
      const step = Math.max(15, Math.ceil((endMinute - startMinute) / 8) || 15)
      const sampleMinutes: number[] = []

      for (let minute = startMinute; minute <= endMinute; minute += step) {
        sampleMinutes.push(minute)
      }
      if (!sampleMinutes.includes(endMinute)) {
        sampleMinutes.push(endMinute)
      }

      console.log('[MapView] fallback minute sweep', {
        flightId: activeFlightId,
        simId,
        startMinute,
        endMinute,
        step,
        sampleMinutes,
      })

      const codeSets = await Promise.all(
        sampleMinutes.map(async (minute) => {
          const response = await authFetch(
            `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments?minute=${minute}`
          )
          if (!response.ok) {
            console.warn('[MapView] fallback minute query failed', {
              flightId: activeFlightId,
              simId,
              minute,
              status: response.status,
            })
            return []
          }

          const codes = (await response.json()) as string[]
          console.log('[MapView] fallback minute query', {
            flightId: activeFlightId,
            simId,
            minute,
            total: codes.length,
            sample: codes.slice(0, 10),
          })
          return codes
        })
      )

      const uniqueCodes = Array.from(new Set(codeSets.flat()))

      console.log('[MapView] fallback unique shipment codes', {
        flightId: activeFlightId,
        simId,
        totalCodes: uniqueCodes.length,
        sample: uniqueCodes.slice(0, 10),
      })

      const routeResults = await Promise.all(
        uniqueCodes.map(async (code) => {
          try {
            const response = await authFetch(
              `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments/${encodeURIComponent(code)}/route`
            )
            if (!response.ok) {
              return null
            }
            return (await response.json()) as ShipmentRoute
          } catch (error) {
            console.warn('[MapView] fallback route fetch failed', {
              flightId: activeFlightId,
              simId,
              code,
              error: error instanceof Error ? error.message : error,
            })
            return null
          }
        })
      )

      const matchingCodes = routeResults
        .filter((route): route is ShipmentRoute => Boolean(route))
        .filter((route) => route.ruta?.some((step) => Number(step.vueloId) === activeFlightId))
        .map((route) => route.codigoPedido)

      console.log('[MapView] fallback matching shipment codes', {
        flightId: activeFlightId,
        simId,
        totalMatches: matchingCodes.length,
        sample: matchingCodes.slice(0, 10),
      })

      const detailedShipments = await Promise.all(
        matchingCodes.map(async (code) => {
          const shipment = await getShipmentByCode(code)
          return shipment
        })
      )

      return detailedShipments.filter((shipment): shipment is ShipmentCrudDto => Boolean(shipment))
    }

    const loadShipments = async () => {
      setFlightShipmentsLoading(true)
      setFlightShipmentsError(null)
      console.log('[MapView] loading flight shipments', {
        flightId: activeFlightId,
        simId,
        detailStage,
        source: simId ? 'simulation' : 'database',
      })

      try {
        const result = simId
          ? await getSimulationShipmentsByFlight(simId, activeFlightId, {
            planId: previewFlight?.planId,
            salidaMin: previewFlight?.salidaMin,
          })
          : await getShipmentsByFlight(activeFlightId)

        if (!cancelled) {
          console.log('[MapView] flight shipments loaded', {
            flightId: activeFlightId,
            simId,
            total: result.length,
            codes: result.slice(0, 10).map((shipment) => shipment.codigoPedido),
            source: simId ? 'simulation' : 'database',
          })
          setFlightShipments(result)

          if (result.length === 0 && simId) {
            try {
              const flightCrudFallback = await getShipmentsByFlight(activeFlightId)
              if (!cancelled) {
                console.warn('[MapView] simulation shipments empty, fallback to flight crud', {
                  flightId: activeFlightId,
                  simId,
                  total: flightCrudFallback.length,
                  codes: flightCrudFallback.slice(0, 10).map((shipment) => shipment.codigoPedido),
                })
                if (flightCrudFallback.length > 0) {
                  setFlightShipments(flightCrudFallback)
                  return
                }
              }
            } catch (flightCrudFallbackError) {
              if (!cancelled) {
                console.warn('[MapView] flight crud fallback failed', {
                  flightId: activeFlightId,
                  simId,
                  error: flightCrudFallbackError instanceof Error ? flightCrudFallbackError.message : flightCrudFallbackError,
                })
              }
            }

            try {
              const fallbackResult = await buildFallbackShipments()
              if (!cancelled) {
                console.warn('[MapView] simulation shipments empty, fallback to database', {
                  flightId: activeFlightId,
                  simId,
                  total: fallbackResult.length,
                  codes: fallbackResult.slice(0, 10).map((shipment) => shipment.codigoPedido),
                })
                setFlightShipments(fallbackResult)
              }
            } catch (fallbackError) {
              if (!cancelled) {
                console.warn('[MapView] fallback shipment fetch failed', {
                  flightId: activeFlightId,
                  simId,
                  error: fallbackError instanceof Error ? fallbackError.message : fallbackError,
                })
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[MapView] flight shipments fetch failed', {
            flightId: activeFlightId,
            simId,
            detailStage,
            error: error instanceof Error ? error.message : error,
          })
          setFlightShipments([])
          setFlightShipmentsError(
            error instanceof Error ? error.message : 'No se pudo cargar los envíos del vuelo',
          )
        }
      } finally {
        if (!cancelled) {
          setFlightShipmentsLoading(false)
        }
      }
    }

    void loadShipments()

    return () => {
      cancelled = true
    }
  }, [detailStage, previewFlightId, previewFlight?.flightId, simId])

  const quarterMinute = currentMinute !== null ? Math.floor(currentMinute / 15) * 15 : null

  useEffect(() => {
    if (previewAirportCode === null || previewAirport === null) {
      lastAirportCodeRef.current = null
      return
    }

    let cancelled = false
    const isNewAirport = previewAirportCode !== lastAirportCodeRef.current

    const loadAirportShipments = async () => {
      if (isNewAirport) {
        setAirportShipmentsLoading(true)
        setAirportShipmentsError(null)
        setAirportShipments([]) // Clear old shipments to avoid showing stale data
        lastAirportCodeRef.current = previewAirportCode
      }

      const queryMinute = simId ? quarterMinute : null
      console.log('[MapView] loading airport shipments', {
        airportCode: previewAirport.codigoOaci,
        simId,
        detailStage: airportDetailStage,
        minute: queryMinute,
        source: simId ? 'simulation' : 'database',
        isNewAirport,
      })

      try {
        const result = await getAirportShipments(previewAirport.codigoOaci, {
          simId,
          minute: queryMinute,
        })

        if (!cancelled) {
          // Solo filtrar por status en modo no-simulación; en simulación el backend se encargará
          const activeShipments = simId
            ? result
            : result.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED')
          console.log('[MapView] airport shipments loaded', {
            airportCode: previewAirport.codigoOaci,
            simId,
            total: result.length,
            filtered: activeShipments.length,
            codes: activeShipments.slice(0, 10).map((shipment) => shipment.codigoPedido),
            source: simId ? 'simulation' : 'database',
          })
          setAirportShipments(activeShipments)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[MapView] airport shipments fetch failed', {
            airportCode: previewAirport.codigoOaci,
            simId,
            detailStage: airportDetailStage,
            error: error instanceof Error ? error.message : error,
          })
          if (isNewAirport) {
            setAirportShipments([])
            setAirportShipmentsError(
              error instanceof Error ? error.message : 'No se pudo cargar los envíos del aeropuerto',
            )
          }
        }
      } finally {
        if (!cancelled && isNewAirport) {
          setAirportShipmentsLoading(false)
        }
      }
    }

    void loadAirportShipments()

    return () => {
      cancelled = true
    }
  }, [quarterMinute, previewAirport, previewAirportCode, simId])

  const invalidateMapSize = () => {
    if (!mapRef.current) {
      return
    }

    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current)
    }
    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current)
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ animate: false })
      resizeFrameRef.current = null
    })

    resizeTimerRef.current = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false })
      resizeTimerRef.current = null
    }, 350)
  }

  const handleResetView = () => {
    mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true })
  }

  const closePreviewFlight = () => {
    closedPreviewFlightIdRef.current = previewFlightId
    setPreviewFlightId(null)
    setDetailStage('flight')
    setFlightShipments([])
    setFlightShipmentsError(null)
    setSelectedShipment(null)
    setFlightShipmentsLoading(false)
    onFlightPreview?.(null)
  }

  const closePreviewAirport = () => {
    closedPreviewAirportCodeRef.current = previewAirportCode
    setPreviewAirportCode(null)
    setAirportDetailStage('airport')
    setAirportShipments([])
    setAirportShipmentsError(null)
    setSelectedAirportShipment(null)
    setAirportShipmentsLoading(false)
  }

  const trackBag = (bagCode: string) => {
    setTrackerCode(bagCode)
    setIsTrackerOpen(true)
    void onSearchShipment?.(bagCode)
  }

  const openShipmentsStage = () => {
    if (previewFlightId === null) {
      return
    }

    console.log('[MapView] open shipments stage', {
      flightId: previewFlightId,
      simId,
    })
    setDetailStage('shipments')
  }

  const goBackToFlightCard = () => {
    setDetailStage('flight')
    setSelectedShipment(null)
    setFlightShipmentsError(null)
  }

  const openShipmentDetails = (shipment: ShipmentCrudDto) => {
    setSelectedShipment(shipment)
    setDetailStage('shipmentDetails')
  }

  const goBackToShipmentsList = () => {
    setDetailStage('shipments')
    setSelectedShipment(null)
  }

  const openAirportShipmentsStage = () => {
    if (previewAirportCode === null) {
      return
    }

    console.log('[MapView] open airport shipments stage', {
      airportCode: previewAirportCode,
      simId,
      minute: currentMinute,
    })
    setAirportDetailStage('shipments')
  }

  const goBackToAirportCard = () => {
    setAirportDetailStage('airport')
    setSelectedAirportShipment(null)
    setAirportShipmentsError(null)
  }

  const openAirportShipmentDetails = (shipment: ShipmentCrudDto) => {
    setSelectedAirportShipment(shipment)
    setAirportDetailStage('shipmentDetails')
  }

  const goBackToAirportShipmentsList = () => {
    setAirportDetailStage('shipments')
    setSelectedAirportShipment(null)
  }

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      worldCopyJump: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    const routePane = map.createPane(MAP_PANES.route)
    const cancelledRoutePane = map.createPane(MAP_PANES.cancelledRoute)
    const airportPane = map.createPane(MAP_PANES.airport)
    const planePane = map.createPane(MAP_PANES.plane)

    routePane.style.zIndex = '420'
    cancelledRoutePane.style.zIndex = '430'
    airportPane.style.zIndex = '520'
    planePane.style.zIndex = '620'

    new MaptilerLayer({
      apiKey: YOUR_API_KEY,
      style: MAPTILER_STYLE_URL,
    }).addTo(map)

    const zoomControl = L.control.zoom({ position: 'bottomright' }).addTo(map)
    window.setTimeout(() => {
      const container = zoomControl.getContainer()
      if (!container) {
        return
      }
      const zoomIn = container.querySelector('.leaflet-control-zoom-in') as HTMLAnchorElement | null
      const zoomOut = container.querySelector('.leaflet-control-zoom-out') as HTMLAnchorElement | null
      if (zoomIn) {
        zoomIn.title = 'Acercar'
        zoomIn.setAttribute('aria-label', 'Acercar')
      }
      if (zoomOut) {
        zoomOut.title = 'Alejar'
        zoomOut.setAttribute('aria-label', 'Alejar')
      }
    }, 0)

    // [NUEVO] El continentLayerRef NO se inicializa aquí porque la capa GeoJSON se crea y destruye
    // dinámicamente en su propio useEffect (ver abajo). Al no añadirla aquí primero,
    // se garantiza que quede por debajo de los aeropuertos y aviones en el orden de capas de Leaflet.

    airportLayerRef.current = L.layerGroup().addTo(map)
    planeLayerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)
    cancelledRouteLayerRef.current = L.layerGroup().addTo(map)
    ghostLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map
  }, [])

  // [NUEVO] Efecto que dibuja o limpia la capa de resaltado del continente en el mapa.
  //
  // Se ejecuta cada vez que cambia `continentFeatureCollection` (lo que ocurre cuando el usuario
  // cambia el filtro de continente en la UI).
  //
  // Estrategia de re-renderizado:
  //   1. Eliminamos la capa GeoJSON anterior del mapa si existe.
  //   2. Si hay un feature collection válido, creamos una nueva capa L.geoJSON y la añadimos.
  //   3. Guardamos la referencia en continentLayerRef para poder limpiarla en el siguiente render.
  //
  // La capa se inserta DEBAJO de los aeropuertos y aviones (zIndex del pane por defecto: ~200)
  // para no tapar los marcadores existentes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    // Limpiamos la capa anterior para evitar polígonos duplicados al cambiar de continente.
    if (continentLayerRef.current) {
      continentLayerRef.current.remove()
      continentLayerRef.current = null
    }

    // Si no hay continente seleccionado (null o 'ALL'), simplemente no dibujamos nada.
    if (!continentFeatureCollection) {
      return
    }

    // Creamos la nueva capa GeoJSON con estilo semitransparente.
    // fillOpacity: 0.12  → relleno azul muy sutil para no opacar el mapa base.
    // weight: 1.5        → borde fino pero visible.
    // dashArray          → guión para distinguirlo de rutas de vuelo sólidas.
    const layer = L.geoJSON(continentFeatureCollection, {
      style: {
        color: '#3b82f6',        // Azul (Tailwind blue-500) para el borde
        weight: 1.5,
        opacity: 0.7,
        fillColor: '#3b82f6',   // Mismo azul para el relleno
        fillOpacity: 0.12,       // 12% de opacidad → efecto muy suave, no invasivo
        dashArray: '4 4',        // Borde punteado sutil
      },
    }).addTo(map)

    // Guardamos referencia para poder limpiarlo en el próximo ciclo.
    continentLayerRef.current = layer
  }, [continentFeatureCollection])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const handleMapClick = () => {
      setPreviewAirportCode(null)
      setPreviewFlightId(null)
      onAirportPreview?.(null)
      onFlightPreview?.(null)
    }

    map.on('click', handleMapClick)

    return () => {
      map.off('click', handleMapClick)
    }
  }, [onAirportPreview, onFlightPreview])

  // Leaflet no detecta cambios de tamaño provocados por CSS grid/flex, como el colapso del sidebar.
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver(() => invalidateMapSize())
    observer.observe(container)
    invalidateMapSize()

    return () => {
      observer.disconnect()
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    invalidateMapSize()
  }, [isFullscreen, isPanelCollapsed, isToolbarCollapsed])

  useEffect(() => {
    if (previewAirportCode !== null && !airports.some((airport) => airport.codigoOaci === previewAirportCode)) {
      setPreviewAirportCode(null)
    }
  }, [airports, previewAirportCode])

  useEffect(() => {
    if (previewFlightId !== null && !segments.some((segment) => segment.flightId === previewFlightId)) {
      setPreviewFlightId(null)
    }
  }, [segments, previewFlightId])

  useEffect(() => {
    if (selectedAirportCode === null) {
      closedPreviewAirportCodeRef.current = null
      if (previewAirportCode !== null) {
        setPreviewAirportCode(null)
      }
      return
    }

    if (closedPreviewAirportCodeRef.current !== selectedAirportCode) {
      closedPreviewAirportCodeRef.current = null
    }

    if (
      selectedAirportCode !== previewAirportCode &&
      closedPreviewAirportCodeRef.current !== selectedAirportCode
    ) {
      setPreviewAirportCode(selectedAirportCode)
      setAirportDetailStage('airport')
    }
  }, [previewAirportCode, selectedAirportCode, currentMinute])

  useEffect(() => {
    if (selectedFlightId === null) {
      closedPreviewFlightIdRef.current = null
      if (previewFlightId !== null) {
        setPreviewFlightId(null)
      }
      return
    }

    if (closedPreviewFlightIdRef.current !== selectedFlightId) {
      closedPreviewFlightIdRef.current = null
    }

    if (
      selectedFlightId !== previewFlightId &&
      closedPreviewFlightIdRef.current !== selectedFlightId
    ) {
      setPreviewFlightId(selectedFlightId)
    }
  }, [previewFlightId, selectedFlightId])

  useMapSelectionFocus({
    mapRef,
    airports,
    segments,
    currentMinute,
    selectedFlightId,
    selectedAirportCode,
    selectedShipmentRoute,
    defaultCenter: DEFAULT_CENTER,
    defaultZoom: DEFAULT_ZOOM,
  })

  useEffect(() => {
    if (!airportLayerRef.current) {
      return
    }
    airportLayerRef.current.clearLayers()

    airports.forEach((airport) => {
      const snapshot = warehouseSnapshot[airport.codigoOaci]
      const percent = snapshot ? snapshot.porcentaje : null
      const colors = percent === null
        ? NEUTRAL_SEMAPHORE_COLORS
        : resolveSemaphoreColor(percent, ranges)
      const isSelected = selectedAirportCode !== null && airport.codigoOaci === selectedAirportCode

      const icon = buildAirportIcon(colors, isSelected)
      const marker = L.marker([airport.latitud, airport.longitud], {
        icon,
        pane: MAP_PANES.airport,
      })
      const tooltipParts = [
        `${airport.codigoOaci} - ${airport.nombre}`,
      ]
      if (snapshot) {
        tooltipParts.push(`Uso: ${formatPercent(snapshot.porcentaje)}`)
        tooltipParts.push(`Ocupacion: ${formatInteger(snapshot.ocupacion)}/${formatInteger(snapshot.capacidad)}`)
      }
      const tooltip = tooltipParts.join('<br/>')
      marker.bindTooltip(tooltip, {
        direction: 'top',
        permanent: false,
        opacity: 0.95,
      })
      if (isSelected) {
        marker.setZIndexOffset(1000)
      }
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event.originalEvent)
        if (previewAirportCode === airport.codigoOaci) {
          closedPreviewAirportCodeRef.current = null
          setPreviewAirportCode(null)
          onAirportPreview?.(null)
          return
        }

        closedPreviewAirportCodeRef.current = null
        setPreviewAirportCode(airport.codigoOaci)
        setAirportDetailStage('airport')
        onAirportPreview?.(airport.codigoOaci)
      })
      marker.addTo(airportLayerRef.current as L.LayerGroup)
    })
  }, [airports, warehouseSnapshot, ranges, selectedAirportCode, onAirportPreview, previewAirportCode])

  useEffect(() => {
    if (!planeLayerRef.current) {
      return
    }

    const layer = planeLayerRef.current
    const nextActiveIds = new Set<number>()

    if (currentMinute === null) {
      planeMarkersRef.current.forEach((marker) => {
        layer.removeLayer(marker)
      })
      planeMarkersRef.current.clear()
      return
    }

    const activeSegments = segments.filter(
      (seg) => currentMinute >= seg.salidaMin && currentMinute <= seg.llegadaMin
    )

    activeSegments.forEach((seg) => {
      if (cancelledFlightIdSet.has(seg.flightId)) {
        return
      }

      nextActiveIds.add(seg.flightId)
      const total = Math.max(1, seg.llegadaMin - seg.salidaMin)
      const progress = Math.min(1, Math.max(0, (currentMinute - seg.salidaMin) / total))
      const map = mapRef.current
      const { lat, lon, heading } = getFlightArcPosition(
        seg.origenLat,
        seg.origenLon,
        seg.destinoLat,
        seg.destinoLon,
        progress,
        map
      )
      const capacity = seg.capacidad

      const isSelectedFlight = selectedFlightId !== null && seg.flightId === selectedFlightId
      const isSelectedShipment = selectedShipmentRoute != null && selectedShipmentRoute.ruta.some(p => p.vueloId === seg.flightId)

      const isSelected = isSelectedFlight || isSelectedShipment
      const anySelectionActive = selectedFlightId !== null || selectedShipmentRoute != null
      const isDimmed = anySelectionActive && !isSelected

      const icon = buildPlaneIcon(heading, seg.carga, seg.capacidad, ranges, isDimmed, isSelectedFlight)

      const tooltipParts = [
        `Vuelo ${seg.flightId}`,
        `${seg.origen} → ${seg.destino}`,
        capacity !== undefined
          ? `Maletas: ${formatBags(seg.carga)} / ${formatBags(capacity)}`
          : 'Capacidad: n/d',
      ]
      const tooltip = `${tooltipParts.join('<br/>')}`

      let marker = planeMarkersRef.current.get(seg.flightId)
      if (!marker) {
        marker = L.marker([lat, lon], {
          icon,
          pane: MAP_PANES.plane,
          bubblingMouseEvents: false,
        })
        marker.bindTooltip(tooltip, {
          direction: 'top',
          permanent: isSelectedShipment,
          opacity: 0.95,
        })
        marker.on('click', (event) => {
          L.DomEvent.stop(event.originalEvent)
          if (previewFlightId === seg.flightId) {
            closedPreviewFlightIdRef.current = null
            setPreviewFlightId(null)
            onFlightPreview?.(null)
            return
          }

          closedPreviewFlightIdRef.current = null
          setPreviewFlightId(seg.flightId)
          onFlightPreview?.(seg.flightId)
        })
        marker.addTo(layer)
        planeMarkersRef.current.set(seg.flightId, marker)
      } else {
        marker.setLatLng([lat, lon])
        marker.setIcon(icon)
        const tooltipInstance = marker.getTooltip()
        if (tooltipInstance) {
          tooltipInstance.setContent(tooltip)
          if (isSelectedShipment) {
            marker.openTooltip()
          } else if (!isSelectedShipment && tooltipInstance.isOpen()) {
            marker.closeTooltip()
          }
        }
      }

      marker.setZIndexOffset(isSelected ? 500 : 0)
    })

    planeMarkersRef.current.forEach((marker, flightId) => {
      if (!nextActiveIds.has(flightId)) {
        layer.removeLayer(marker)
        planeMarkersRef.current.delete(flightId)
      }
    })
  }, [segments, currentMinute, selectedFlightId, selectedShipmentRoute, ranges, onFlightPreview, previewFlightId, cancelledFlightIdSet])

  useEffect(() => {
    const layer = routeLayerRef.current
    if (!layer) {
      return
    }

    layer.clearLayers()

    if (currentMinute === null) {
      return
    }

    // 1) Rutas "de fondo": TODOS los vuelos actualmente en el aire (mismo criterio que
    // usan los íconos de avión), en trazo fino, tenue y punteado, con el color de su semáforo.
    const activeSegments = segments.filter(
      (seg) => currentMinute >= seg.salidaMin && currentMinute <= seg.llegadaMin
    )

    activeSegments.forEach((seg) => {
      if (selectedFlightId !== null && seg.flightId === selectedFlightId) {
        return // la ruta del vuelo seleccionado se dibuja después, por encima del resto
      }

      /*const percent =
        seg.capacidad !== undefined && seg.capacidad > 0
          ? (seg.carga * 100) / seg.capacidad
          : null*/
      //const colors = percent === null ? NEUTRAL_SEMAPHORE_COLORS : resolveSemaphoreColor(percent, ranges)

      L.polyline(
        buildRouteArc(seg.origenLat, seg.origenLon, seg.destinoLat, seg.destinoLon),
        { ...ALL_FLIGHTS_ROUTE_BASE_STYLE, color: '#000000' }
      ).addTo(layer)
    })

    // 2) Ruta de un envío/maleta específico: tiene prioridad y se dibuja por encima de todo.
    if (selectedShipmentRoute && selectedShipmentRoute.ruta && selectedShipmentRoute.ruta.length > 0) {
      selectedShipmentRoute.ruta.forEach((paso) => {
        const orig = airports.find((a) => a.codigoOaci === paso.origen)
        const dest = airports.find((a) => a.codigoOaci === paso.destino)

        if (!orig || !dest) {
          return
        }

        L.polyline(
          buildRouteArc(orig.latitud, orig.longitud, dest.latitud, dest.longitud),
          getShipmentStepStyle(paso, currentMinute)
        ).addTo(layer)
      })
      return
    }

    // 3) Ruta del vuelo seleccionado, resaltada (gruesa) por encima de las rutas de fondo.
    if (selectedFlightId !== null) {
      const selectedSegment = segments.find((segment) => segment.flightId === selectedFlightId)
      if (selectedSegment) {
        const hasDeparted = currentMinute >= selectedSegment.salidaMin
        const isLanded = currentMinute >= selectedSegment.llegadaMin

        // Estilos: Definimos el estilo opaco copiando el original pero bajando la opacidad.
        // Opcional: le agregué un 'dashArray' para que se vea punteada la parte que ya pasó.
        const TRAVERSED_STYLE = { ...SELECTED_ROUTE_STYLE, opacity: 0.5, dashArray: '5, 5' }
        const REMAINING_STYLE = SELECTED_ROUTE_STYLE

        if (hasDeparted && !isLanded) {
          // 1. El avión está en el aire: calculamos su posición exacta
          const total = Math.max(1, selectedSegment.llegadaMin - selectedSegment.salidaMin)
          const progress = Math.min(1, Math.max(0, (currentMinute - selectedSegment.salidaMin) / total))
          const { lat: currentLat, lon: currentLon } = getFlightArcPosition(
            selectedSegment.origenLat,
            selectedSegment.origenLon,
            selectedSegment.destinoLat,
            selectedSegment.destinoLon,
            progress,
            mapRef.current
          )

          L.polyline(
            buildRouteArc(selectedSegment.origenLat, selectedSegment.origenLon, currentLat, currentLon),
            TRAVERSED_STYLE
          ).addTo(layer)

          L.polyline(
            buildRouteArc(currentLat, currentLon, selectedSegment.destinoLat, selectedSegment.destinoLon),
            REMAINING_STYLE
          ).addTo(layer)

        } else if (isLanded) {
          L.polyline(
            buildRouteArc(
              selectedSegment.origenLat,
              selectedSegment.origenLon,
              selectedSegment.destinoLat,
              selectedSegment.destinoLon
            ),
            LANDED_ROUTE_STYLE
          ).addTo(layer)
        } else {
          L.polyline(
            buildRouteArc(
              selectedSegment.origenLat,
              selectedSegment.origenLon,
              selectedSegment.destinoLat,
              selectedSegment.destinoLon
            ),
            REMAINING_STYLE
          ).addTo(layer)
        }
      }
    }
  }, [selectedFlightId, selectedShipmentRoute, airports, segments, currentMinute, ranges])

  useEffect(() => {
    const layer = cancelledRouteLayerRef.current
    if (!layer) {
      return
    }

    layer.clearLayers()

    if (currentMinute === null || cancelledFlightIdSet.size === 0) {
      return
    }

    (cancelledFlightTraces ?? []).forEach((trace) => {
      if (!cancelledFlightIdSet.has(trace.flightId)) {
        return
      }

      if (currentMinute < trace.salidaMin || currentMinute > trace.llegadaMin) {
        return
      }

      const originAirport = airports.find(a => a.latitud === trace.origenLat && a.longitud === trace.origenLon)?.codigoOaci || 'Desconocido'
      const destAirport = airports.find(a => a.latitud === trace.destinoLat && a.longitud === trace.destinoLon)?.codigoOaci || 'Desconocido'

      const startDate = formatDateFromDayIndex(Math.floor(trace.salidaMin / 1440))
      const startTime = formatClockFromMinute(trace.salidaMin)
      const endDate = formatDateFromDayIndex(Math.floor(trace.llegadaMin / 1440))
      const endTime = formatClockFromMinute(trace.llegadaMin)

      L.polyline(
        buildRouteArc(trace.origenLat, trace.origenLon, trace.destinoLat, trace.destinoLon),
        CANCELLED_ROUTE_STYLE
      ).bindTooltip(
        `<div style="text-align: center;">
          <strong>Vuelo Cancelado</strong><br/>
          Origen: ${originAirport}<br/>
          Destino: ${destAirport}<br/>
          Inicio: ${startDate} - ${startTime}<br/>
          Fin: ${endDate} - ${endTime}
        </div>`,
        { direction: 'auto', sticky: true, permanent: showCancelledDetails, className: 'cancelled-flight-tooltip' }
      ).addTo(layer)
    })
  }, [cancelledFlightTraces, currentMinute, cancelledFlightIdSet, airports, showCancelledDetails])

  // 👻 Efecto "fantasma": detecta vuelos que desaparecieron de `segments` porque ya
  // aterrizaron (currentMinute superó su llegadaMin) y los guarda en memoria temporal
  // para poder seguir dibujando su ruta unos segundos más mientras se desvanece.
  useEffect(() => {
    const layer = ghostLayerRef.current
    if (!layer) {
      return
    }

    if (currentMinute === null) {
      // Simulación reiniciada o sin datos: limpiamos cualquier fantasma y el snapshot previo.
      landedGhostsRef.current.forEach((ghost) => layer.removeLayer(ghost.polyline))
      landedGhostsRef.current.clear()
      prevSegmentsMapRef.current = new Map()
      return
    }

    const prevMap = prevSegmentsMapRef.current
    const currentIds = new Set(segments.map((seg) => seg.flightId))

    prevMap.forEach((prevSeg, flightId) => {
      const stillPresent = currentIds.has(flightId)
      const alreadyGhost = landedGhostsRef.current.has(flightId)

      if (!stillPresent && !alreadyGhost && currentMinute > prevSeg.llegadaMin) {
        const polyline = L.polyline(
          buildRouteArc(prevSeg.origenLat, prevSeg.origenLon, prevSeg.destinoLat, prevSeg.destinoLon),
          GHOST_ROUTE_STYLE
        ).addTo(layer)

        landedGhostsRef.current.set(flightId, { polyline, startedAt: Date.now() })
      }
    })

    // Actualizamos el snapshot para poder comparar en el próximo cambio de `segments`.
    prevSegmentsMapRef.current = new Map(segments.map((seg) => [seg.flightId, seg]))
  }, [segments, currentMinute])

  // ⏱️ Intervalo único que va bajando la opacidad de cada ruta fantasma hasta que
  // desaparece por completo (a los GHOST_FADE_DURATION_MS milisegundos reales).
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const layer = ghostLayerRef.current
      if (!layer) {
        return
      }

      landedGhostsRef.current.forEach((ghost, flightId) => {
        const elapsed = Date.now() - ghost.startedAt
        if (elapsed >= GHOST_FADE_DURATION_MS) {
          layer.removeLayer(ghost.polyline)
          landedGhostsRef.current.delete(flightId)
          return
        }

        const remainingRatio = 1 - elapsed / GHOST_FADE_DURATION_MS
        ghost.polyline.setStyle({ opacity: (GHOST_ROUTE_STYLE.opacity ?? 0.7) * remainingRatio })
      })
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [])

  const hasRealOnlyTime = Boolean(timeLabel && !simDurationLabel && !secondaryTimeLabel && !realDurationLabel)
  const hasSimulationTimeGroup = Boolean(timeLabel && !hasRealOnlyTime)
  const hasRealTimeGroup = Boolean(secondaryTimeLabel || realDurationLabel || hasRealOnlyTime)
  const hasVisibleSimulationTimeGroup = Boolean(
    (timeLabel && hasSimulationTimeGroup && visibleTimeItems.simulatedDate) ||
    (simDurationLabel && visibleTimeItems.simulatedDuration),
  )
  const hasVisibleRealTimeGroup = Boolean(
    ((secondaryTimeLabel || hasRealOnlyTime) && visibleTimeItems.actualDate) ||
    (realDurationLabel && visibleTimeItems.actualDuration),
  )

  return (
    <div ref={wrapperRef} className="map-wrapper">
      <button
        className="map-fullscreen-btn"
        onClick={onToggleFullscreen}
        title={isFullscreen ? "Salir" : "Expandir"}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <button
        className="map-reset-view-btn"
        onClick={handleResetView}
        title="Restablecer vista"
        aria-label="Restablecer zoom y posición del mapa"
      >
        <RotateCcw size={17} />
      </button>
      <button
        className="map-settings-btn"
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        title="Configuración de visualización"
        aria-label="Configuración de visualización"
      >
        <Settings size={18} />
      </button>

      {isSettingsOpen && (
        <div className="map-settings-panel">
          <div className="map-settings-panel-header">
            <strong>Mostrar Tiempos</strong>
            <button className="map-settings-panel-close" onClick={() => setIsSettingsOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="map-settings-panel-content">
            {hasSimulationTimeGroup ? (
              <label className="map-settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleTimeItems.simulatedDate}
                  onChange={(e) => setVisibleTimeItems(prev => ({ ...prev, simulatedDate: e.target.checked }))}
                />
                Momento simulado
              </label>
            ) : null}
            {simDurationLabel ? (
              <label className="map-settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleTimeItems.simulatedDuration}
                  onChange={(e) => setVisibleTimeItems(prev => ({ ...prev, simulatedDuration: e.target.checked }))}
                />
                Ventana mostrada
              </label>
            ) : null}
            {secondaryTimeLabel || hasRealOnlyTime ? (
              <label className="map-settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleTimeItems.actualDate}
                  onChange={(e) => setVisibleTimeItems(prev => ({ ...prev, actualDate: e.target.checked }))}
                />
                Hoy
              </label>
            ) : null}
            {realDurationLabel ? (
              <label className="map-settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleTimeItems.actualDuration}
                  onChange={(e) => setVisibleTimeItems(prev => ({ ...prev, actualDuration: e.target.checked }))}
                />
                Corriendo hace
              </label>
            ) : null}
          </div>
        </div>
      )}

      {timeLabel || secondaryTimeLabel ? (
        <div className="map-time-tabs" aria-label="Tiempos del mapa">
          {hasSimulationTimeGroup ? (
            <div className="map-time-group map-time-group--simulated">
              {timeLabel && visibleTimeItems.simulatedDate ? (
                <MapTimeChip
                  icon={PlayCircle}
                  label="Momento simulado"
                  value={timeLabel}
                  tone="simulated"
                  onClose={() => setVisibleTimeItems(prev => ({ ...prev, simulatedDate: false }))}
                />
              ) : null}
              {simDurationLabel && visibleTimeItems.simulatedDuration ? (
                <MapTimeChip
                  icon={CalendarClock}
                  label="Ventana mostrada"
                  value={simDurationLabel}
                  tone="simulated"
                  onClose={() => setVisibleTimeItems(prev => ({ ...prev, simulatedDuration: false }))}
                />
              ) : null}
            </div>
          ) : null}
          {hasVisibleSimulationTimeGroup && hasVisibleRealTimeGroup ? (
            <div className="map-time-divider" aria-hidden="true" />
          ) : null}
          {hasRealTimeGroup ? (
            <div className="map-time-group map-time-group--real">
              {(secondaryTimeLabel || (hasRealOnlyTime ? timeLabel : null)) && visibleTimeItems.actualDate ? (
                <MapTimeChip
                  icon={Calendar}
                  label="Hoy"
                  value={secondaryTimeLabel ?? timeLabel ?? ''}
                  tone="real"
                  onClose={() => setVisibleTimeItems(prev => ({ ...prev, actualDate: false }))}
                />
              ) : null}
              {realDurationLabel && visibleTimeItems.actualDuration ? (
                <MapTimeChip
                  icon={Timer}
                  label="Corriendo hace"
                  value={realDurationLabel}
                  tone="real"
                  onClose={() => setVisibleTimeItems(prev => ({ ...prev, actualDuration: false }))}
                />
              ) : null}
            </div>
          ) : null}
          {isPaused && (
            <div className="map-time-tab--paused-wrapper">
              <div className="map-time-tab map-time-tab--paused">
                Simulación pausada
              </div>
            </div>
          )}
        </div>
      ) : null}
      <ShipmentRouteTracker
        selectedShipmentRoute={selectedShipmentRoute}
        shipmentSearchError={shipmentSearchError}
        currentMinute={currentMinute}
        trackedCode={trackerCode}
        isOpen={isTrackerOpen}
        onSearchShipment={onSearchShipment}
        onClearShipmentRoute={onClearShipmentRoute}
        onTrackedCodeChange={setTrackerCode}
        onOpenChange={setIsTrackerOpen}
      />
      {previewFlight && detailStage === 'flight' ? (
        <MapFloatingCard
          actionLabel="Ver detalle completo"
          secondaryActionLabel="Ver envíos"
          onSecondaryAction={openShipmentsStage}
          badge={`Vuelo ${previewFlight.flightId}`}
          metrics={[
            {
              label: 'Uso',
              value: formatPercent(getFlightLoadPercent(previewFlight), 1),
            },
            {
              label: 'Maletas',
              value: previewFlight.capacidad !== undefined
                ? `${formatBags(previewFlight.carga)}/${formatBags(previewFlight.capacidad)}`
                : `${formatBags(previewFlight.carga)}/--`,
            },
          ]}
          onAction={() => onFlightDetailRequest?.(previewFlight.flightId)}
          onClose={closePreviewFlight}
          statusColor={resolveSemaphoreColor(
            getFlightLoadPercent(previewFlight),
            ranges
          ).fill}
          statusLabel={getSemaphoreLabel(
            getFlightLoadPercent(previewFlight),
            ranges
          )}
          subtitle={formatMinuteRange(previewFlight.salidaMin, previewFlight.llegadaMin)}
          title={`${previewFlight.origen} → ${previewFlight.destino}`}
        />
      ) : previewFlight && detailStage === 'shipments' ? (
        <div className="map-floating-card" style={{ width: 'min(460px, calc(100% - 32px))' }}>
          <div className="map-floating-card-header">
            <div className="map-floating-card-title">
              <span className="map-floating-card-badge">Vuelo {previewFlight.flightId}</span>
              <strong>Envíos asignados</strong>
            </div>
            <button
              type="button"
              className="map-floating-card-close"
              onClick={closePreviewFlight}
              aria-label="Cerrar detalle"
            >
              ×
            </button>
          </div>

          <div className="map-floating-card-body">
            <div className="map-floating-card-subtitle">
              {previewFlight.origen} → {previewFlight.destino}
            </div>

            <button type="button" className="btn ghost" onClick={goBackToFlightCard}>
              ← Volver
            </button>

            {flightShipmentsLoading ? (
              <div className="crud-empty">Cargando envíos del vuelo...</div>
            ) : null}

            {flightShipmentsError ? (
              <div className="crud-error" style={{ margin: 0 }}>
                {flightShipmentsError}
              </div>
            ) : null}

            {!flightShipmentsLoading && !flightShipmentsError && flightShipments.length === 0 ? (
              <div className="crud-empty">No hay envíos asignados a este vuelo.</div>
            ) : null}

            {!flightShipmentsLoading && !flightShipmentsError ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {flightShipments.map((shipment) => {
                  const statusClass = (shipment.status ?? 'pending').toLowerCase().replace(/_/g, '-')

                  return (
                    <div
                      key={shipment.id ?? shipment.codigoPedido}
                      style={{
                        display: 'grid',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid #d9e4f4',
                        background: '#f8fbff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: '#10213a' }}>{shipment.codigoPedido}</div>
                          <div style={{ fontSize: '12px', color: '#52647d' }}>
                            {shipment.origen} → {shipment.destino}
                          </div>
                        </div>
                        <span className={`status-badge ${statusClass}`}>
                          {shipment.status ?? 'PENDING'}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: '8px',
                        }}
                      >
                        <div className="map-floating-card-metric" style={{ minHeight: '64px' }}>
                          <strong style={{ fontSize: '18px' }}>{formatBags(shipment.cantidad)}</strong>
                          <span>Maletas</span>
                        </div>
                        <div className="map-floating-card-metric" style={{ minHeight: '64px' }}>
                          <strong style={{ fontSize: '18px' }}>
                            {formatDurationHours(shipment.slaHoras, 0)}
                          </strong>
                          <span>SLA</span>
                        </div>
                        <div className="map-floating-card-metric" style={{ minHeight: '64px' }}>
                          <strong style={{ fontSize: '18px' }}>{shipment.asignado ? 'Sí' : 'No'}</strong>
                          <span>Asignado</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="map-floating-card-action"
                        onClick={() => openShipmentDetails(shipment)}
                        style={{ minHeight: '40px', fontSize: '14px' }}
                      >
                        Ver maletas
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : previewFlight && detailStage === 'shipmentDetails' ? (
        <div className="map-floating-card" style={{ width: 'min(420px, calc(100% - 32px))' }}>
          <div className="map-floating-card-header">
            <div className="map-floating-card-title">
              <span className="map-floating-card-badge">Maletas</span>
              <strong>{selectedShipment?.codigoPedido ?? `Vuelo ${previewFlight.flightId}`}</strong>
            </div>
            <button
              type="button"
              className="map-floating-card-close"
              onClick={closePreviewFlight}
              aria-label="Cerrar detalle"
            >
              ×
            </button>
          </div>

          <div className="map-floating-card-body">
            <div className="map-floating-card-subtitle">
              {previewFlight.origen} → {previewFlight.destino}
            </div>

            <button type="button" className="btn ghost" onClick={goBackToShipmentsList}>
              ← Volver
            </button>

            {selectedShipment ? (
              <>
                <div className="map-floating-card-metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="map-floating-card-metric">
                    <strong>{formatBags(selectedShipment.cantidad)}</strong>
                    <span>Número de maletas</span>
                  </div>
                  <div className="map-floating-card-metric">
                    <strong>{selectedShipment.idCliente || '--'}</strong>
                    <span>Cliente</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '8px',
                    border: '1px solid #d9e4f4',
                    borderRadius: '12px',
                    padding: '12px',
                    background: '#f8fbff',
                    fontSize: '13px',
                    color: '#334155',
                  }}
                >
                  <div><strong>Origen:</strong> {selectedShipment.origen}</div>
                  <div><strong>Destino:</strong> {selectedShipment.destino}</div>
                  <div><strong>Estado:</strong> {selectedShipment.status ?? 'PENDING'}</div>
                  <div><strong>SLA:</strong> {formatDurationHours(selectedShipment.slaHoras, 0)}</div>
                </div>

                <div className="entity-bag-list">
                  {buildShipmentBagCodes(selectedShipment.codigoPedido, selectedShipment.cantidad).map((bagCode) => (
                    <button
                      key={bagCode}
                      type="button"
                      className="entity-bag-chip"
                      onClick={() => trackBag(bagCode)}
                    >
                      {bagCode}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="crud-empty">Selecciona un envío para ver sus maletas.</div>
            )}
          </div>
        </div>
      ) : previewAirport && airportDetailStage === 'airport' ? (() => {
        // ENTRANTE: envíos cuyo origen NO es este aeropuerto (vinieron de otro lugar)
        const incomingShipmentsList = airportShipments.filter(ship => ship.origen !== previewAirport.codigoOaci);
        // SALIENTE: envíos que originan aquí O que están en tránsito (destino final != este aeropuerto)
        const outgoingShipmentsList = airportShipments.filter(ship =>
          ship.origen === previewAirport.codigoOaci || ship.destino !== previewAirport.codigoOaci
        );

        const incomingShipmentsCount = incomingShipmentsList.length;
        const incomingBagsCount = incomingShipmentsList.reduce((sum, s) => sum + (s.cantidad ?? 0), 0);

        const outgoingShipmentsCount = outgoingShipmentsList.length;
        const outgoingBagsCount = outgoingShipmentsList.reduce((sum, s) => sum + (s.cantidad ?? 0), 0);

        return (
          <MapFloatingCard
            actionLabel="Ver detalle completo"
            secondaryActionLabel="Ver envíos"
            onSecondaryAction={openAirportShipmentsStage}
            badge={previewAirport.codigoOaci}
            loading={airportShipmentsLoading}
            metrics={[
              {
                label: 'Uso',
                value: formatPercent(warehouseSnapshot[previewAirport.codigoOaci]?.porcentaje, 1),
              },
              {
                label: 'Ocupación',
                value: warehouseSnapshot[previewAirport.codigoOaci]
                  ? `${formatInteger(warehouseSnapshot[previewAirport.codigoOaci].ocupacion)}/${formatInteger(warehouseSnapshot[previewAirport.codigoOaci].capacidad)}`
                  : `0/${formatInteger(previewAirport.capacidad)}`,
              },
              {
                label: 'Envios entrantes',
                value: String(incomingShipmentsCount),
              },
              {
                label: 'Maletas entrantes',
                value: formatBags(incomingBagsCount),
              },
              {
                label: 'Envios salientes',
                value: String(outgoingShipmentsCount),
              },
              {
                label: 'Maletas salientes',
                value: formatBags(outgoingBagsCount),
              }
            ]}
            onAction={() => onAirportDetailRequest?.(previewAirport.codigoOaci)}
            onClose={closePreviewAirport}
            statusColor={resolveSemaphoreColor(
              warehouseSnapshot[previewAirport.codigoOaci]?.porcentaje,
              ranges
            ).fill}
            statusLabel={getSemaphoreLabel(
              warehouseSnapshot[previewAirport.codigoOaci]?.porcentaje,
              ranges
            )}
            subtitle={previewAirport.pais}
            title={previewAirport.nombre}
          />
        );
      })() : previewAirport && airportDetailStage === 'shipments' ? (
        <div className="map-floating-card" style={{ width: 'min(460px, calc(100% - 32px))' }}>
          <div className="map-floating-card-header">
            <div className="map-floating-card-title">
              <span className="map-floating-card-badge">{previewAirport.codigoOaci}</span>
              <strong>Envíos en el almacén</strong>
            </div>
            <button
              type="button"
              className="map-floating-card-close"
              onClick={closePreviewAirport}
              aria-label="Cerrar detalle"
            >
              ×
            </button>
          </div>

          <div className="map-floating-card-body">
            <div className="map-floating-card-subtitle">{previewAirport.nombre}</div>

            <button type="button" className="btn ghost" onClick={goBackToAirportCard}>
              ← Volver
            </button>

            {/* Filtro Entrante / Saliente / Todos */}
            <div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
              {(['all', 'entrante', 'saliente'] as const).map((filterVal) => {
                const labels: Record<typeof filterVal, string> = { all: 'Todos', entrante: 'Entrantes', saliente: 'Salientes' };
                const isActive = shipmentFilterType === filterVal;
                return (
                  <button
                    key={filterVal}
                    type="button"
                    onClick={() => setShipmentFilterType(filterVal)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: isActive ? '2px solid #3b82f6' : '1px solid #ccc',
                      background: isActive ? '#e8f0fe' : '#fff',
                      color: isActive ? '#1a56db' : '#555',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {labels[filterVal]}
                  </button>
                );
              })}
            </div>

            {airportShipmentsLoading ? (
              <div className="crud-empty">Cargando envíos del aeropuerto...</div>
            ) : null}

            {airportShipmentsError ? (
              <div className="crud-error" style={{ margin: 0 }}>
                {airportShipmentsError}
              </div>
            ) : null}

            {!airportShipmentsLoading && !airportShipmentsError && (() => {
              const code = previewAirport.codigoOaci;
              const displayShipments = airportShipments.filter(ship => {
                if (shipmentFilterType === 'entrante') return ship.origen !== code;
                if (shipmentFilterType === 'saliente') return ship.origen === code || ship.destino !== code;
                return true;
              });

              if (displayShipments.length === 0) {
                return <div className="crud-empty">No hay envíos {shipmentFilterType === 'all' ? 'en este aeropuerto' : shipmentFilterType === 'entrante' ? 'entrantes' : 'salientes'}.</div>;
              }

              return (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {displayShipments.map((shipment) => {
                    const statusClass = (shipment.status ?? 'pending').toLowerCase().replace(/_/g, '-');
                    // Determinar badges de tipo
                    const isEntrante = shipment.origen !== code;
                    const isSaliente = shipment.origen === code || shipment.destino !== code;

                    return (
                      <div
                        key={shipment.id ?? shipment.codigoPedido}
                        style={{
                          display: 'grid',
                          gap: '10px',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1px solid #d9e4f4',
                          background: '#f8fbff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: '#10213a' }}>{shipment.codigoPedido}</div>
                            <div style={{ fontSize: '12px', color: '#52647d' }}>
                              {shipment.origen} → {shipment.destino}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              {isEntrante && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>ENTRANTE</span>}
                              {isSaliente && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>SALIENTE</span>}
                            </div>
                          </div>
                          <span className={`status-badge ${statusClass}`}>
                            {shipment.status ?? 'PENDING'}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: '8px',
                          }}
                        >
                          <div className="map-floating-card-metric" style={{ minHeight: '64px' }}>
                            <strong style={{ fontSize: '18px' }}>{formatBags(shipment.cantidad)}</strong>
                            <span>Maletas</span>
                          </div>
                          <div className="map-floating-card-metric" style={{ minHeight: '64px' }}>
                            <strong style={{ fontSize: '18px' }}>
                              {formatDurationHours(shipment.slaHoras, 0)}
                            </strong>
                            <span>SLA</span>
                          </div>
                          <div className="map-floating-card-metric" style={{ minHeight: '64px' }}>
                            <strong style={{ fontSize: '18px' }}>{shipment.asignado ? 'Sí' : 'No'}</strong>
                            <span>Asignado</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="map-floating-card-action"
                          onClick={() => openAirportShipmentDetails(shipment)}
                          style={{ minHeight: '40px', fontSize: '14px' }}
                        >
                          Ver maletas
                        </button>
                      </div>
                    )
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      ) : previewAirport && airportDetailStage === 'shipmentDetails' ? (
        <div className="map-floating-card" style={{ width: 'min(420px, calc(100% - 32px))' }}>
          <div className="map-floating-card-header">
            <div className="map-floating-card-title">
              <span className="map-floating-card-badge">Maletas</span>
              <strong>{selectedAirportShipment?.codigoPedido ?? previewAirport.codigoOaci}</strong>
            </div>
            <button
              type="button"
              className="map-floating-card-close"
              onClick={closePreviewAirport}
              aria-label="Cerrar detalle"
            >
              ×
            </button>
          </div>

          <div className="map-floating-card-body">
            <div className="map-floating-card-subtitle">{previewAirport.nombre}</div>

            <button type="button" className="btn ghost" onClick={goBackToAirportShipmentsList}>
              ← Volver
            </button>

            {selectedAirportShipment ? (
              <>
                <div className="map-floating-card-metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="map-floating-card-metric">
                    <strong>{formatBags(selectedAirportShipment.cantidad)}</strong>
                    <span>Número de maletas</span>
                  </div>
                  <div className="map-floating-card-metric">
                    <strong>{selectedAirportShipment.idCliente || '--'}</strong>
                    <span>Cliente</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '8px',
                    border: '1px solid #d9e4f4',
                    borderRadius: '12px',
                    padding: '12px',
                    background: '#f8fbff',
                    fontSize: '13px',
                    color: '#334155',
                  }}
                >
                  <div><strong>Origen:</strong> {selectedAirportShipment.origen}</div>
                  <div><strong>Destino:</strong> {selectedAirportShipment.destino}</div>
                  <div><strong>Estado:</strong> {selectedAirportShipment.status ?? 'PENDING'}</div>
                  <div><strong>SLA:</strong> {formatDurationHours(selectedAirportShipment.slaHoras, 0)}</div>
                </div>

                <div className="entity-bag-list">
                  {buildShipmentBagCodes(selectedAirportShipment.codigoPedido, selectedAirportShipment.cantidad).map((bagCode) => (
                    <button
                      key={bagCode}
                      type="button"
                      className="entity-bag-chip"
                      onClick={() => trackBag(bagCode)}
                    >
                      {bagCode}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="crud-empty">Selecciona un envío para ver sus maletas.</div>
            )}
          </div>
        </div>
      ) : null}
      <div ref={containerRef} className="map"></div>
    </div>
  )
}

function getFlightLoadPercent(segment: FlightSegmentDto) {
  if (segment.capacidad === undefined || segment.capacidad <= 0) {
    return undefined
  }
  return (segment.carga / segment.capacidad) * 100
}

function getSemaphoreLabel(
  percent: number | null | undefined,
  ranges: { greenMax: number; amberMax: number }
) {
  const level = resolveSemaphoreLevel(percent, ranges)
  if (level === 'green') {
    return `Semáforo: verde (0% - ${ranges.greenMax}%)`
  }
  if (level === 'amber') {
    return `Semáforo: ámbar (${ranges.greenMax + 1}% - ${ranges.amberMax}%)`
  }
  if (level === 'red') {
    return `Semáforo: rojo (${ranges.amberMax + 1}% - 100%)`
  }
  return 'Semáforo: sin datos'
}
