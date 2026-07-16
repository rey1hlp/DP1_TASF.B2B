import { ArrowLeft, ArrowUpDown, CircleDot, Clock3, Filter, MapPin, Package, PlaneLanding, PlaneTakeoff, Search, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import useVirtualList from '../hooks/useVirtualList'
import type { EntityFocusRequest } from '../types/entityFocus'
import type { AirportTextFilters, FlightTextFilters, MapSemaphoreFilters, SemaphoreFilterLevel } from '../types/mapFilters'
import type { EnvioDetalleDto, ShipmentCrudDto } from '../types/sim'
// 1. Asegúrate de importar la función de simulación desde tu api
import { getShipmentsByFlight, getSimulationShipmentsByFlight } from '../services/api'
import './EntityExplorer.css'

// 2. Importa el hook del contexto de simulación
import { useSimulationContext } from '../contexts/SimulationContext'

import {
  formatDurationHours,
  formatBags,
  formatInteger,
  formatMinuteRangeWithGmt,
  formatPercent,
  formatShipmentDepartureTime,
  formatSimDateTimeFromMinuteWithGmt,
  formatSimMinuteWithGmt,
  parseShipmentDepartureMinute,
} from '../utils/time'
import { resolveSemaphoreColor, resolveSemaphoreLevel, type SemaphoreRanges } from '../utils/semaphore'

export type EntityTab = 'flights' | 'shipments' | 'airports'

export type EntityFlightItem = {
  flightId: number
  planId?: number | null
  codigo?: string | null
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
  estado?: string
  carga?: number
  capacidad?: number
  porcentaje?: number
  color?: string
}

export type EntityAirportItem = {
  codigoOaci: string
  nombre: string
  pais: string
  continente?: string
  capacidad?: number
  ocupacion?: number
  porcentaje?: number
  nextDepartureMin?: number
  nextArrivalMin?: number
  color?: string
}

export type EntityRouteStep = {
  vueloId: number | string
  planId?: number | string | null
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
}

export type EntityShipmentRoute = {
  codigoPedido: string
  codigoMaleta?: string
  numeroMaleta?: number
  totalMaletas?: number
  consultaMaleta?: boolean
  estado: string
  tiempoTotalHoras: number
  ruta: EntityRouteStep[]
}

function cloneBagRoute(
  route: EntityShipmentRoute,
  bagCode: string,
  bagIndex: number,
  totalBags: number,
): EntityShipmentRoute {
  return {
    ...route,
    codigoMaleta: bagCode,
    numeroMaleta: bagIndex + 1,
    totalMaletas: totalBags,
    consultaMaleta: true,
  }
}

export type ShipmentCategory = 'PLANIFICADOS' | 'EN_VUELO' | 'ENTREGADOS'
type SidebarView = 'shipment-detail' | 'bag-detail'

export type EntityExplorerProps = {
  flights: EntityFlightItem[]
  airports: EntityAirportItem[]
  airportGmtByCode?: Record<string, number>
  shipments: string[]
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute: EntityShipmentRoute | null
  onSelectFlight: (flightId: number) => void
  onSelectAirport: (codigoOaci: string) => void
  flightFilters: FlightTextFilters
  onFlightFiltersChange: (filters: FlightTextFilters) => void
  ranges: SemaphoreRanges
  mapFilters: MapSemaphoreFilters
  onMapFiltersChange: (filters: MapSemaphoreFilters) => void
  mapFilterCounts?: { flights: number; warehouses: number }
  airportFilters: AirportTextFilters
  onAirportFiltersChange: (filters: AirportTextFilters) => void
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  currentMinute: number | null
  focusRequest?: EntityFocusRequest | null
  shipmentQuantities?: Record<string, number>
  shipmentFlightIds?: Record<string, string[]>
  shipmentClientIds?: Record<string, string | null | undefined>
  onSelectShipmentRoute?: (route: EntityShipmentRoute) => void
  shipmentsPlanificados?: EnvioDetalleDto[]
  shipmentsEnVuelo?: EnvioDetalleDto[]
  shipmentsEntregados?: EnvioDetalleDto[]
  selectedShipmentCategory?: ShipmentCategory
  onSelectedShipmentCategoryChange?: (category: ShipmentCategory) => void
  shipmentOriginFilter?: string
  onShipmentOriginFilterChange?: (value: string) => void
  shipmentDestinationFilter?: string
  onShipmentDestinationFilterChange?: (value: string) => void
  labels?: {
    airportHint?: string
    airportHintNoun?: string
    airportPlaceholder?: string
    airportTitle?: string
    flightHint?: string
    flightHintNoun?: string
    flightPlaceholder?: string
    flightTitle?: string
    shipmentEmpty?: string
    shipmentHint?: string
    shipmentHintNoun?: string
    shipmentIcon?: string
    shipmentPlaceholder?: string
    shipmentTitle?: string
  }
  listHeight?: number
  shipmentListHeight?: number
  showCancelledDetails?: boolean
  onShowCancelledDetailsChange?: (val: boolean) => void
}

type FlightSortKey =
  | 'default'
  | 'occupancy'
  | 'departure'
  | 'arrival'
  | 'origin'
  | 'destination'

type AirportSortKey = 'occupancy' | 'departure' | 'arrival'
type ShipmentSortKey =
  | 'default'
  | 'bags'
  | 'departure'
  | 'delivery'
  | 'origin'
  | 'destination'

type SortDirection = 'asc' | 'desc'

const FLIGHT_ITEM_HEIGHT = 96
const AIRPORT_ITEM_HEIGHT = 106
const SHIPMENT_ITEM_HEIGHT = 106
const AIRPORT_PREVIEW_LIMIT = 30

const FLIGHT_SORT_DEFAULT_DIRECTION: Record<FlightSortKey, SortDirection> = {
  default: 'asc',
  occupancy: 'desc',
  departure: 'asc',
  arrival: 'asc',
  origin: 'asc',
  destination: 'asc',
}

const AIRPORT_SORT_DEFAULT_DIRECTION: Record<AirportSortKey, SortDirection> = {
  occupancy: 'desc',
  departure: 'asc',
  arrival: 'asc',
}

const SHIPMENT_SORT_DEFAULT_DIRECTION: Record<ShipmentSortKey, SortDirection> = {
  default: 'asc',
  bags: 'desc',
  departure: 'asc',
  delivery: 'asc',
  origin: 'asc',
  destination: 'asc',
}

const SEMAPHORE_OPTIONS: Array<{ value: SemaphoreFilterLevel; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'green', label: 'Verde' },
  { value: 'amber', label: 'Ámbar' },
  { value: 'red', label: 'Rojo' },
  { value: 'unknown', label: 'Sin datos' },
]

function getFlightOccupancyValue(flight: EntityFlightItem) {
  if (typeof flight.porcentaje === 'number') return flight.porcentaje
  if (
    typeof flight.carga === 'number' &&
    typeof flight.capacidad === 'number' &&
    flight.capacidad > 0
  ) {
    return (flight.carga * 100) / flight.capacidad
  }

  return null
}

function getSemaphoreOptionPercent(
  option: (typeof SEMAPHORE_OPTIONS)[number],
  ranges: SemaphoreRanges,
) {
  return getSemaphoreFilterPercent(option.value, ranges)
}

function getSemaphoreFilterPercent(
  value: SemaphoreFilterLevel,
  ranges: SemaphoreRanges,
) {
  if (value === 'green') return 0
  if (value === 'amber') return ranges.greenMax + 1
  if (value === 'red') return ranges.amberMax + 1
  return null
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: SortDirection,
) {
  const leftMissing = left === null || left === undefined || Number.isNaN(left)
  const rightMissing = right === null || right === undefined || Number.isNaN(right)

  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return direction === 'asc' ? left - right : right - left
}

function compareText(left: string, right: string, direction: SortDirection) {
  const result = left.localeCompare(right)
  return direction === 'asc' ? result : -result
}

function getShipmentStatusLabel(status?: string | null): string {
  if (!status) return 'Desconocido'
  const s = status.toUpperCase().replace('-', '_')
  switch (s) {
    case 'PENDING':
      return 'Pendiente'
    case 'ASSIGNED':
      return 'Asignado'
    case 'IN_TRANSIT':
      return 'En Tránsito'
    case 'DELIVERED':
      return 'Entregado'
    case 'CANCELLED':
      return 'Cancelado'
    case 'CON_RETRASO':
      return 'Entregado (Con Retraso)'
    default:
      return status
  }
}

function getDynamicShipmentStatus(route: EntityShipmentRoute, currentMinute: number | null) {
  if (!route || route.ruta.length === 0) return getShipmentStatusLabel(route?.estado)
  if (currentMinute === null) return getShipmentStatusLabel(route.estado)

  const first = route.ruta[0]
  const last = route.ruta[route.ruta.length - 1]

  if (currentMinute < first.salidaMin) {
    return 'EN ALMACÉN (Origen)'
  }
  if (currentMinute > last.llegadaMin) {
    return route.estado?.toUpperCase() === 'CANCELLED'
      ? getShipmentStatusLabel(route.estado)
      : 'Entregado'
  }

  for (const step of route.ruta) {
    if (currentMinute >= step.salidaMin && currentMinute <= step.llegadaMin) {
      return `EN VUELO (${step.origen} → ${step.destino})`
    }
  }
  return 'EN ESCALA (Almacén)'
}

function formatBagCode(codigoPedido: string, index: number) {
  return `${codigoPedido}-${String(index + 1).padStart(3, '0')}`
}

function buildBagCodes(codigoPedido: string, cantidad?: number) {
  const total = Math.max(0, Math.floor(cantidad ?? 0))
  return Array.from({ length: total }, (_, index) => formatBagCode(codigoPedido, index))
}

function maxBagTotal(...values: Array<number | null | undefined>) {
  return Math.max(
    0,
    ...values
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => Math.max(0, Math.floor(value))),
  )
}

function normalizeEntityCode(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function normalizeAirportCode(value?: string | null) {
  return value?.trim().toUpperCase() ?? ''
}

function resolveAirportGmt(
  airportGmtByCode: Record<string, number>,
  code?: string | null,
): number | null {
  const lookupKey = normalizeAirportCode(code)
  if (!lookupKey) {
    return null
  }
  const value = airportGmtByCode[lookupKey]
  return Number.isFinite(value) ? value : null
}

function isLikelyBagCode(value: string) {
  return /-\d{3}$/.test(value.trim())
}

function getBagNumberFromCode(value?: string | null) {
  const match = value?.trim().match(/-(\d{3})$/)
  return match ? Number(match[1]) : undefined
}

function getShipmentStatusKind(status?: string, hasRoute = true) {
  const normalized = status?.toUpperCase()
  if (normalized === 'DELIVERED' || normalized === 'ENTREGADO') return 'delivered'
  if (normalized === 'CANCELLED' || normalized === 'CANCELADO') return 'cancelled'
  if (normalized === 'SIN_RUTA_ENCONTRADA' || !hasRoute) return 'no-route'
  return 'active'
}

function getRouteStepState(step: EntityRouteStep, currentMinute: number | null) {
  if (currentMinute === null) return 'pending'
  if (currentMinute >= step.salidaMin && currentMinute <= step.llegadaMin) return 'active'
  if (currentMinute > step.llegadaMin) return 'done'
  return 'pending'
}

type BagListProps = {
  shipmentCode: string
  totalBags: number
  selectedBagCode: string | null
  onSelectBag: (bagCode: string) => void
}

function BagList({ shipmentCode, totalBags, selectedBagCode, onSelectBag }: BagListProps) {
  return (
    <div className="entity-bag-panel">
      <div className="entity-toolbar-label">
        Maletas de {shipmentCode}
      </div>
      <div className="entity-bag-list">
        {buildBagCodes(shipmentCode, totalBags).map((bagCode) => (
          <button
            key={bagCode}
            type="button"
            className={`entity-bag-chip ${selectedBagCode === bagCode ? 'active' : ''}`}
            onClick={() => onSelectBag(bagCode)}
          >
            {bagCode}
          </button>
        ))}
      </div>
    </div>
  )
}

type BagDetailPanelProps = {
  route: EntityShipmentRoute | null
  airportGmtByCode: Record<string, number>
  selectedBagCode: string | null
  clientId?: string | null
  activeBagIndex: number
  totalBags: number
  currentMinute: number | null
  shipmentSearchError: string | null
  onPreviousBag: () => void
  onNextBag: () => void
  onBack: () => void
}

function BagDetailPanel({
  route,
  airportGmtByCode,
  selectedBagCode,
  clientId,
  activeBagIndex,
  totalBags,
  currentMinute,
  shipmentSearchError,
  onPreviousBag,
  onNextBag,
  onBack,
}: BagDetailPanelProps) {
  const displayedCode = route?.codigoMaleta || selectedBagCode || route?.codigoPedido || '--'
  const dynamicStatus = route ? getDynamicShipmentStatus(route, currentMinute) : 'Cargando ruta'
  const statusKind = getShipmentStatusKind(route?.estado, Boolean(route?.ruta.length))
  const inferredBagNumber = route?.numeroMaleta ?? (activeBagIndex >= 0 ? activeBagIndex + 1 : getBagNumberFromCode(selectedBagCode))
  const safeTotalBags = Math.max(totalBags, route?.totalMaletas ?? 0, inferredBagNumber ?? 0)
  const canNavigateBags = safeTotalBags > 1
  const pieceLabel =
    inferredBagNumber && safeTotalBags
      ? `${inferredBagNumber} de ${safeTotalBags}`
      : safeTotalBags
        ? `-- de ${safeTotalBags}`
        : '--'

  return (
    <section className="bag-detail-card" aria-label="Detalle de maleta">
      <button
        type="button"
        className="bag-detail-back"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        <span>Volver al envío</span>
      </button>

      <div className="bag-detail-heading">
        <Package size={18} />
        <div>
          <span>Ficha de Detalle de la Maleta</span>
          <strong>{displayedCode}</strong>
          {clientId ? <small>Cliente: {clientId}</small> : null}
        </div>
      </div>

      {shipmentSearchError && !route ? (
        <div className="bag-detail-error">{shipmentSearchError}</div>
      ) : null}

      {!route && !shipmentSearchError ? (
        <div className="bag-detail-loading">Consultando ruta de la maleta...</div>
      ) : null}

      {route ? (
        <>
          <div className="bag-detail-summary">
            <div className="bag-detail-summary-state">
              <span>Estado</span>
              <strong className={`bag-detail-state ${statusKind}`}>{dynamicStatus}</strong>
            </div>
            <div className="bag-detail-summary-piece">
              <span>Pieza</span>
              <div className="bag-piece-pager" aria-label="Navegar entre maletas del envío">
                {canNavigateBags ? (
                  <button
                    type="button"
                    onClick={onPreviousBag}
                    disabled={activeBagIndex <= 0}
                    aria-label="Maleta anterior"
                    title="Maleta anterior"
                  >
                    ◀
                  </button>
                ) : null}
                <strong>{pieceLabel}</strong>
                {canNavigateBags ? (
                  <button
                    type="button"
                    onClick={onNextBag}
                    disabled={activeBagIndex >= safeTotalBags - 1}
                    aria-label="Siguiente maleta"
                    title="Siguiente maleta"
                  >
                    ▶
                  </button>
                ) : null}
              </div>
            </div>
            <div className="bag-detail-summary-time">
              <span>Tiempo total</span>
              <strong>{formatDurationHours(route.tiempoTotalHoras)}</strong>
            </div>
          </div>

          <div className="bag-detail-route-title">
            <Timer size={14} />
            <span>Tramos</span>
          </div>

          <div className="bag-detail-route">
            {route.ruta.length === 0 ? (
              <div className={`bag-detail-empty ${statusKind}`}>No hay tramos registrados.</div>
            ) : (
              route.ruta.map((step, index) => (
                <div
                  key={`${step.vueloId}-${step.origen}-${step.destino}-${index}`}
                  className={`bag-detail-step ${getRouteStepState(step, currentMinute)}`}
                >
                  <span>{step.planId ?? step.vueloId ?? '--'}</span>
                  <strong>{step.origen} → {step.destino}</strong>
                  <small>
                    {formatMinuteRangeWithGmt(
                      step.salidaMin,
                      step.llegadaMin,
                      resolveAirportGmt(airportGmtByCode, step.origen),
                      resolveAirportGmt(airportGmtByCode, step.destino),
                    )}
                  </small>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default function EntityExplorer({
  flights,
  airports,
  airportGmtByCode = {},
  shipments,
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentRoute,
  onSelectFlight,
  onSelectAirport,
  flightFilters,
  onFlightFiltersChange,
  ranges,
  mapFilters,
  onMapFiltersChange,
  mapFilterCounts,
  airportFilters,
  onAirportFiltersChange,
  onSearchShipment,
  shipmentSearchError,
  currentMinute,
  focusRequest,
  shipmentQuantities = {},
  shipmentFlightIds = {},
  shipmentClientIds = {},
  onSelectShipmentRoute,
  labels,
  listHeight = 320,
  shipmentListHeight = 220,
  shipmentsPlanificados = [],
  showCancelledDetails = true,
  onShowCancelledDetailsChange,
  shipmentsEnVuelo = [],
  shipmentsEntregados = [],
  selectedShipmentCategory = 'EN_VUELO',
  onSelectedShipmentCategoryChange,
  shipmentOriginFilter = '',
  onShipmentOriginFilterChange,
  shipmentDestinationFilter = '',
  onShipmentDestinationFilterChange,
}: EntityExplorerProps) {
  const flightListRef = useRef<HTMLDivElement>(null)
  const airportListRef = useRef<HTMLDivElement>(null)
  const shipmentListRef = useRef<HTMLDivElement>(null)

  const [activeEntityTab, setActiveEntityTab] = useState<EntityTab>("flights");
  const [flightSortKey, setFlightSortKey] = useState<FlightSortKey>('default')
  const [flightSortDirection, setFlightSortDirection] = useState<SortDirection>('asc')
  const [isFlightFilterMenuOpen, setIsFlightFilterMenuOpen] = useState(false)
  const [isFlightSortMenuOpen, setIsFlightSortMenuOpen] = useState(false)
  const [isFlightSemaphoreMenuOpen, setIsFlightSemaphoreMenuOpen] = useState(false)
  const [airportSortKey, setAirportSortKey] = useState<AirportSortKey>('occupancy')
  const [airportSortDirection, setAirportSortDirection] = useState<SortDirection>('desc')
  const [isAirportFilterMenuOpen, setIsAirportFilterMenuOpen] = useState(false)
  const [isAirportSortMenuOpen, setIsAirportSortMenuOpen] = useState(false)
  const [isAirportSemaphoreMenuOpen, setIsAirportSemaphoreMenuOpen] = useState(false)
  const [shipmentSortKey, setShipmentSortKey] = useState<ShipmentSortKey>('default')
  const [shipmentSortDirection, setShipmentSortDirection] = useState<SortDirection>('asc')
  const [isShipmentFilterMenuOpen, setIsShipmentFilterMenuOpen] = useState(false)
  const [isShipmentSortMenuOpen, setIsShipmentSortMenuOpen] = useState(false)
  const [shipmentQuery, setShipmentQuery] = useState("");
  const [shipmentFlightFilter, setShipmentFlightFilter] = useState('')
  const [expandedShipmentCode, setExpandedShipmentCode] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>('shipment-detail')
  const [selectedBagCode, setSelectedBagCode] = useState<string | null>(null)
  const [activeBagIndex, setActiveBagIndex] = useState(0)

  const { simulation } = useSimulationContext();
  const simId = simulation.simId;

  const [flightShipments, setFlightShipments] = useState<ShipmentCrudDto[] | null>(null);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [errorShipments, setErrorShipments] = useState<string | null>(null);
  const selectedFlight = useMemo(
    () => flights.find((flight) => flight.flightId === selectedFlightId) ?? null,
    [flights, selectedFlightId],
  )
  const selectedFlightDisplayId = selectedFlight?.planId ?? selectedFlightId
  const selectedFlightLabel = selectedFlight?.codigo
    ? `${selectedFlightDisplayId} (${selectedFlight.codigo})`
    : selectedFlightDisplayId

  useEffect(() => {
    if (!selectedFlightId) {
      setFlightShipments(null);
      return;
    }

    let cancelled = false;
    setLoadingShipments(true);
    setErrorShipments(null);

    // 2. BIFURCACIÓN INTELIGENTE: 
    // Si hay un simId activo en el contexto, llama al nuevo endpoint de simulación.
    // Si no lo hay, usa el endpoint clásico de la base de datos ordinaria.
    const fetchShipments = simId
      ? getSimulationShipmentsByFlight(simId, selectedFlightId, {
          planId: selectedFlight?.planId ?? undefined,
          salidaMin: selectedFlight?.salidaMin,
        })
      : getShipmentsByFlight(selectedFlight?.planId ?? selectedFlightId, selectedFlight?.codigo);

    fetchShipments
      .then((data) => {
        if (!cancelled) setFlightShipments(data);
      })
      .catch((err) => {
        if (!cancelled) setErrorShipments(err?.message || 'Error al cargar maletas del vuelo');
      })
      .finally(() => {
        if (!cancelled) setLoadingShipments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFlight, selectedFlightId, simId]); // 3. ⚠️ Añadimos 'simId' aquí para que reaccione si cambia la simulación
  // --- FIN CÓDIGO ACTUALIZADO ---

  const filteredFlights = useMemo(() => {
    const codeQuery = flightFilters.codeQuery.trim().toLowerCase()
    const originQuery = flightFilters.originQuery.trim().toLowerCase()
    const destinationQuery = flightFilters.destinationQuery.trim().toLowerCase()
    const semaphoreFilter = mapFilters.flights.semaphore

    return flights.filter((flight) => {
      const displayFlightId = flight.planId ?? flight.flightId
      if (
        codeQuery &&
        !String(displayFlightId).toLowerCase().includes(codeQuery) &&
        !String(flight.flightId).toLowerCase().includes(codeQuery) &&
        !(flight.codigo ?? '').toLowerCase().includes(codeQuery)
      ) {
        return false
      }

      if (originQuery && !flight.origen.toLowerCase().includes(originQuery)) {
        return false
      }

      if (destinationQuery && !flight.destino.toLowerCase().includes(destinationQuery)) {
        return false
      }

      if (
        semaphoreFilter !== 'all' &&
        resolveSemaphoreLevel(getFlightOccupancyValue(flight), ranges) !== semaphoreFilter
      ) {
        return false
      }

      return true
    })
  }, [flightFilters.codeQuery, flightFilters.destinationQuery, flightFilters.originQuery, flights, mapFilters.flights.semaphore, ranges]);

  const orderedFlights = useMemo(() => {
    if (flightSortKey === 'default') {
      return filteredFlights
    }

    return [...filteredFlights].sort((left, right) => {
      switch (flightSortKey) {
        case 'occupancy': {
          const result = compareNullableNumber(
            getFlightOccupancyValue(left),
            getFlightOccupancyValue(right),
            flightSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'departure': {
          const result = compareNullableNumber(
            left.salidaMin,
            right.salidaMin,
            flightSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'arrival': {
          const result = compareNullableNumber(
            left.llegadaMin,
            right.llegadaMin,
            flightSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'origin': {
          const result = compareText(left.origen, right.origen, flightSortDirection)
          if (result !== 0) return result
          break
        }
        case 'destination': {
          const result = compareText(left.destino, right.destino, flightSortDirection)
          if (result !== 0) return result
          break
        }
        default:
          break
      }

      return (left.planId ?? left.flightId) - (right.planId ?? right.flightId)
    })
  }, [filteredFlights, flightSortDirection, flightSortKey]);

  const airportCodeQuery = airportFilters.codeQuery.trim().toLowerCase()
  const airportContinentQuery = airportFilters.continentQuery.trim().toLowerCase()

  const filteredAirports = useMemo(() => {
    const semaphoreFilter = mapFilters.warehouses.semaphore

    return airports.filter((airport) => {
      if (airportCodeQuery && !airport.codigoOaci.toLowerCase().includes(airportCodeQuery)) {
        return false
      }

      if (
        airportContinentQuery &&
        !(airport.continente ?? '').trim().toLowerCase().includes(airportContinentQuery)
      ) {
        return false
      }

      if (
        semaphoreFilter !== 'all' &&
        resolveSemaphoreLevel(airport.porcentaje ?? null, ranges) !== semaphoreFilter
      ) {
        return false
      }

      return true
    })
  }, [airportCodeQuery, airportContinentQuery, airports, mapFilters.warehouses.semaphore, ranges]);

  const orderedAirports = useMemo(() => {
    return [...filteredAirports].sort((left, right) => {
      switch (airportSortKey) {
        case 'occupancy': {
          const result = compareNullableNumber(
            left.porcentaje,
            right.porcentaje,
            airportSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'departure': {
          const result = compareNullableNumber(
            left.nextDepartureMin,
            right.nextDepartureMin,
            airportSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'arrival': {
          const result = compareNullableNumber(
            left.nextArrivalMin,
            right.nextArrivalMin,
            airportSortDirection,
          )
          if (result !== 0) return result
          break
        }
      }

      return left.codigoOaci.localeCompare(right.codigoOaci)
    })
  }, [airportSortDirection, airportSortKey, filteredAirports])

  const displayedAirports = useMemo(() => {
    if (airportCodeQuery || airportContinentQuery) return orderedAirports
    return orderedAirports.slice(0, AIRPORT_PREVIEW_LIMIT)
  }, [airportCodeQuery, airportContinentQuery, orderedAirports])

  const flightFilterAirportOptions = useMemo(() => {
    return [...airports].sort((left, right) => {
      const codeCompare = left.codigoOaci.localeCompare(right.codigoOaci)
      if (codeCompare !== 0) return codeCompare
      return left.nombre.localeCompare(right.nombre)
    })
  }, [airports])

  const airportContinentOptions = useMemo(() => {
    return Array.from(
      new Set(
        airports
          .map((airport) => (airport.continente ?? '').trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }, [airports])

  const selectedAirportContinentValue = useMemo(() => {
    return (
      airportContinentOptions.find(
        (continent) => continent.toLowerCase() === airportContinentQuery,
      ) ?? ''
    )
  }, [airportContinentOptions, airportContinentQuery])

  const hasCategorizedShipmentItems =
    shipmentsPlanificados.length > 0 ||
    shipmentsEnVuelo.length > 0 ||
    shipmentsEntregados.length > 0

  const selectedCategorizedShipments = useMemo(() => {
    if (selectedShipmentCategory === 'PLANIFICADOS') return shipmentsPlanificados
    if (selectedShipmentCategory === 'ENTREGADOS') return shipmentsEntregados
    return shipmentsEnVuelo
  }, [selectedShipmentCategory, shipmentsEntregados, shipmentsEnVuelo, shipmentsPlanificados])

  const baseShipmentItems = useMemo<EnvioDetalleDto[]>(() => {
    if (hasCategorizedShipmentItems) return selectedCategorizedShipments

    return shipments.map((codigoPedido) => ({
      codigoPedido,
      origen: '--',
      destino: '--',
      ut: '',
      cantidadMaletas: shipmentQuantities[codigoPedido] ?? 0,
      vueloIds: shipmentFlightIds[codigoPedido] ?? [],
      idCliente: shipmentClientIds[codigoPedido] ?? null,
      estado: 'PLANIFICADO',
      minutoEntrega: null,
    }))
  }, [hasCategorizedShipmentItems, selectedCategorizedShipments, shipmentClientIds, shipmentFlightIds, shipmentQuantities, shipments])

  const shipmentOriginOptions = useMemo(() => {
    return Array.from(
      new Set(
        baseShipmentItems
          .map((shipment) => shipment.origen.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }, [baseShipmentItems])

  const shipmentDestinationOptions = useMemo(() => {
    return Array.from(
      new Set(
        baseShipmentItems
          .map((shipment) => shipment.destino.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }, [baseShipmentItems])

  const shipmentFlightOptions = useMemo(() => {
    return Array.from(
      new Set(
        baseShipmentItems
          .flatMap((shipment) => shipment.vueloIds ?? [])
          .map((flightId) => String(flightId).trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  }, [baseShipmentItems])

  const filteredShipmentItems = useMemo(() => {
    const query = shipmentQuery.trim().toLowerCase()
    const originQuery = shipmentOriginFilter.trim().toLowerCase()
    const destinationQuery = shipmentDestinationFilter.trim().toLowerCase()
    const flightQuery = shipmentFlightFilter.trim().toLowerCase()

    return baseShipmentItems.filter((shipment) => {
      if (
        query &&
        !shipment.codigoPedido.toLowerCase().includes(query) &&
        !buildBagCodes(shipment.codigoPedido, shipment.cantidadMaletas).some((bagCode) =>
          bagCode.toLowerCase().includes(query),
        )
      ) {
        return false
      }

      if (originQuery && !shipment.origen.toLowerCase().includes(originQuery)) {
        return false
      }

      if (destinationQuery && !shipment.destino.toLowerCase().includes(destinationQuery)) {
        return false
      }

      if (
        flightQuery &&
        !(shipment.vueloIds ?? []).some((flightId) =>
          String(flightId).toLowerCase().includes(flightQuery),
        )
      ) {
        return false
      }

      return true
    })
  }, [baseShipmentItems, shipmentDestinationFilter, shipmentFlightFilter, shipmentOriginFilter, shipmentQuery])

  const orderedShipmentItems = useMemo(() => {
    if (shipmentSortKey === 'default') {
      return filteredShipmentItems
    }

    return [...filteredShipmentItems].sort((left, right) => {
      switch (shipmentSortKey) {
        case 'bags': {
          const result = compareNullableNumber(
            left.cantidadMaletas,
            right.cantidadMaletas,
            shipmentSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'departure': {
          const leftMinute = parseShipmentDepartureMinute(left.ut)
          const rightMinute = parseShipmentDepartureMinute(right.ut)
          const result = leftMinute !== null || rightMinute !== null
            ? compareNullableNumber(leftMinute, rightMinute, shipmentSortDirection)
            : compareText(left.ut ?? '', right.ut ?? '', shipmentSortDirection)
          if (result !== 0) return result
          break
        }
        case 'delivery': {
          const result = compareNullableNumber(
            left.minutoEntrega,
            right.minutoEntrega,
            shipmentSortDirection,
          )
          if (result !== 0) return result
          break
        }
        case 'origin': {
          const result = compareText(left.origen, right.origen, shipmentSortDirection)
          if (result !== 0) return result
          break
        }
        case 'destination': {
          const result = compareText(left.destino, right.destino, shipmentSortDirection)
          if (result !== 0) return result
          break
        }
        default:
          break
      }

      return left.codigoPedido.localeCompare(right.codigoPedido)
    })
  }, [filteredShipmentItems, shipmentSortDirection, shipmentSortKey])

  const flightList = useVirtualList(orderedFlights, {
    itemHeight: FLIGHT_ITEM_HEIGHT,
    listHeight,
  });
  const airportList = useVirtualList(displayedAirports, {
    itemHeight: AIRPORT_ITEM_HEIGHT,
    listHeight,
  });
  const shipmentList = useVirtualList(orderedShipmentItems, {
    itemHeight: SHIPMENT_ITEM_HEIGHT,
    listHeight: shipmentListHeight,
  });
  const selectedShipmentCodeForBags =
    expandedShipmentCode
    ?? (
      selectedShipmentRoute?.codigoPedido && shipmentQuantities[selectedShipmentRoute.codigoPedido]
        ? selectedShipmentRoute.codigoPedido
        : null
    )
  const selectedShipmentBagTotal = selectedShipmentCodeForBags
    ? maxBagTotal(
        baseShipmentItems.find((shipment) => shipment.codigoPedido === selectedShipmentCodeForBags)?.cantidadMaletas,
        selectedShipmentRoute?.codigoPedido === selectedShipmentCodeForBags
          ? selectedShipmentRoute.totalMaletas
          : undefined,
        shipmentQuantities[selectedShipmentCodeForBags],
      )
    : 0
  const selectedShipmentItem = selectedShipmentCodeForBags
    ? baseShipmentItems.find((shipment) => shipment.codigoPedido === selectedShipmentCodeForBags) ?? null
    : null
  const selectedShipmentBagCodes = useMemo(
    () => selectedShipmentCodeForBags
      ? buildBagCodes(selectedShipmentCodeForBags, selectedShipmentBagTotal)
      : [],
    [selectedShipmentBagTotal, selectedShipmentCodeForBags],
  )
  const selectedShipmentClientId =
    selectedShipmentItem?.idCliente ??
    (selectedShipmentCodeForBags ? shipmentClientIds[selectedShipmentCodeForBags] : null)
    ?? null
  const selectedBagRoute = useMemo(() => {
    if (!selectedBagCode || !selectedShipmentRoute) {
      return null
    }

    const expectedBagCode = normalizeEntityCode(selectedBagCode)
    const routeBagCode = normalizeEntityCode(selectedShipmentRoute.codigoMaleta)
    if (routeBagCode && routeBagCode === expectedBagCode) {
      return cloneBagRoute(selectedShipmentRoute, selectedBagCode, activeBagIndex, selectedShipmentBagTotal)
    }

    const routeShipmentCode = normalizeEntityCode(selectedShipmentRoute.codigoPedido)
    if (
      routeShipmentCode &&
      expectedBagCode.startsWith(`${routeShipmentCode}-`)
    ) {
      return cloneBagRoute(selectedShipmentRoute, selectedBagCode, activeBagIndex, selectedShipmentBagTotal)
    }

    return null
  }, [activeBagIndex, selectedBagCode, selectedShipmentBagTotal, selectedShipmentRoute])

  useEffect(() => {
    if (!selectedBagCode || selectedShipmentBagCodes.length === 0) {
      setActiveBagIndex(0)
      return
    }

    const nextIndex = selectedShipmentBagCodes.findIndex((bagCode) => bagCode === selectedBagCode)
    if (nextIndex >= 0 && nextIndex !== activeBagIndex) {
      setActiveBagIndex(nextIndex)
    }
  }, [activeBagIndex, selectedBagCode, selectedShipmentBagCodes])

  const hasActiveFlightFilters =
    Boolean(flightFilters.codeQuery.trim()) ||
    Boolean(flightFilters.originQuery.trim()) ||
    Boolean(flightFilters.destinationQuery.trim())
  const hasActiveFlightSort = flightSortKey !== 'default'
  const hasActiveFlightSemaphoreFilter = mapFilters.flights.semaphore !== 'all'
  const activeFlightSemaphoreColor = resolveSemaphoreColor(
    getSemaphoreFilterPercent(mapFilters.flights.semaphore, ranges),
    ranges,
  )
  const hasActiveAirportFilters =
    Boolean(airportFilters.codeQuery.trim()) ||
    Boolean(airportFilters.continentQuery.trim())
  const hasActiveAirportSort = airportSortKey !== 'occupancy' || airportSortDirection !== 'desc'
  const hasActiveAirportSemaphoreFilter = mapFilters.warehouses.semaphore !== 'all'
  const activeAirportSemaphoreColor = resolveSemaphoreColor(
    getSemaphoreFilterPercent(mapFilters.warehouses.semaphore, ranges),
    ranges,
  )
  const hasActiveShipmentFilters =
    Boolean(shipmentQuery.trim()) ||
    Boolean(shipmentOriginFilter.trim()) ||
    Boolean(shipmentDestinationFilter.trim()) ||
    Boolean(shipmentFlightFilter.trim())
  const hasActiveShipmentSort = shipmentSortKey !== 'default'

  const getFlightCapacityPercent = (flight: EntityFlightItem) => {
    if (typeof flight.porcentaje === 'number') return flight.porcentaje
    if (
      typeof flight.carga === 'number' &&
      typeof flight.capacidad === 'number' &&
      flight.capacidad > 0
    ) {
      return (flight.carga * 100) / flight.capacidad
    }

    return null
  }

  const getFlightCapacityColor = (flight: EntityFlightItem) => {
    const percent = getFlightCapacityPercent(flight)
    return resolveSemaphoreColor(percent, ranges).fill
  }

  const getAirportOccupancyColor = (airport: EntityAirportItem) => {
    return resolveSemaphoreColor(airport.porcentaje ?? null, ranges).fill
  }

  const handleFlightKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const target = orderedFlights[0];
    if (target) onSelectFlight(target.flightId);
  };

  const handleFlightFilterChange = (
    key: keyof FlightTextFilters,
    value: string,
  ) => {
    onFlightFiltersChange({
      ...flightFilters,
      [key]: value.toUpperCase(),
    })
  }

  const clearFlightFilters = () => {
    onFlightFiltersChange({
      codeQuery: '',
      originQuery: '',
      destinationQuery: '',
    })
    flightList.setScrollTop(0)
  }

  const handleFlightSemaphoreFilterChange = (value: SemaphoreFilterLevel) => {
    onMapFiltersChange({
      ...mapFilters,
      flights: {
        ...mapFilters.flights,
        semaphore: value,
      },
    })
    setIsFlightSemaphoreMenuOpen(false)
    flightList.setScrollTop(0)
  }

  const handleFlightSortPreset = (value: FlightSortKey, direction?: SortDirection) => {
    setFlightSortKey(value)
    setFlightSortDirection(direction ?? FLIGHT_SORT_DEFAULT_DIRECTION[value])
    setIsFlightSortMenuOpen(false)
    flightList.setScrollTop(0)
  }

  const handleFlightSortDirectionToggle = () => {
    if (flightSortKey === 'default') return

    setFlightSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    flightList.setScrollTop(0)
  }

  const handleAirportKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const target = displayedAirports[0];
    if (target) onSelectAirport(target.codigoOaci);
  };

  const handleAirportFilterChange = (
    key: keyof AirportTextFilters,
    value: string,
  ) => {
    onAirportFiltersChange({
      ...airportFilters,
      [key]: key === 'codeQuery' ? value.toUpperCase() : value,
    })
  }

  const clearAirportFilters = () => {
    onAirportFiltersChange({
      codeQuery: '',
      continentQuery: '',
    })
    airportList.setScrollTop(0)
  }

  const handleAirportSemaphoreFilterChange = (value: SemaphoreFilterLevel) => {
    onMapFiltersChange({
      ...mapFilters,
      warehouses: {
        ...mapFilters.warehouses,
        semaphore: value,
      },
    })
    setIsAirportSemaphoreMenuOpen(false)
    airportList.setScrollTop(0)
  }

  const handleAirportSortPreset = (value: AirportSortKey, direction?: SortDirection) => {
    setAirportSortKey(value)
    setAirportSortDirection(direction ?? AIRPORT_SORT_DEFAULT_DIRECTION[value])
    setIsAirportSortMenuOpen(false)
    airportList.setScrollTop(0)
  }

  const handleAirportSortDirectionToggle = () => {
    setAirportSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    airportList.setScrollTop(0)
  }

  const handleShipmentKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const query = shipmentQuery.trim()
    if (query) {
      if (isLikelyBagCode(query)) {
        setSelectedBagCode(query)
        setSidebarView('bag-detail')
      } else {
        setSelectedBagCode(null)
        setSidebarView('shipment-detail')
      }
      onSearchShipment(query)
      return
    }

    const target = orderedShipmentItems[0];
    if (target) {
      setSelectedBagCode(null)
      setSidebarView('shipment-detail')
      onSearchShipment(target.codigoPedido);
    }
  };

  const handleSelectShipment = (codigo: string) => {
    setSelectedBagCode(null)
    setActiveBagIndex(0)
    setSidebarView('shipment-detail')
    setExpandedShipmentCode((current) => (current ? codigo : current))
    onSearchShipment(codigo)
  }

  const handleSelectBag = (bagCode: string) => {
    const nextIndex = Math.max(0, selectedShipmentBagCodes.findIndex((code) => code === bagCode))
    setSelectedBagCode(bagCode)
    setActiveBagIndex(nextIndex)
    setSidebarView('bag-detail')

    if (
      selectedShipmentRoute &&
      selectedShipmentCodeForBags &&
      selectedShipmentRoute.codigoPedido === selectedShipmentCodeForBags
    ) {
      onSelectShipmentRoute?.(
        cloneBagRoute(selectedShipmentRoute, bagCode, nextIndex, selectedShipmentBagTotal),
      )
      return
    }

    onSearchShipment(bagCode)
  }

  const handleBackToShipmentDetail = () => {
    setSidebarView('shipment-detail')
  }

  const handleBagPagerChange = (direction: -1 | 1) => {
    if (!selectedShipmentBagCodes.length || !selectedShipmentRoute) {
      return
    }

    const nextIndex = Math.min(
      selectedShipmentBagCodes.length - 1,
      Math.max(0, activeBagIndex + direction),
    )
    const nextBagCode = selectedShipmentBagCodes[nextIndex]
    if (!nextBagCode || nextIndex === activeBagIndex) {
      return
    }

    setActiveBagIndex(nextIndex)
    setSelectedBagCode(nextBagCode)
    onSelectShipmentRoute?.(
      cloneBagRoute(selectedShipmentRoute, nextBagCode, nextIndex, selectedShipmentBagTotal),
    )
  }

  const clearShipmentFilters = () => {
    setShipmentQuery('')
    onShipmentOriginFilterChange?.('')
    onShipmentDestinationFilterChange?.('')
    setShipmentFlightFilter('')
    shipmentList.setScrollTop(0)
  }

  const handleShipmentSortPreset = (value: ShipmentSortKey, direction?: SortDirection) => {
    setShipmentSortKey(value)
    setShipmentSortDirection(direction ?? SHIPMENT_SORT_DEFAULT_DIRECTION[value])
    setIsShipmentSortMenuOpen(false)
    shipmentList.setScrollTop(0)
  }

  const handleShipmentSortDirectionToggle = () => {
    if (shipmentSortKey === 'default') return

    setShipmentSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    shipmentList.setScrollTop(0)
  }

  useEffect(() => {
    flightList.setScrollTop(0)
  }, [
    flightFilters.codeQuery,
    flightFilters.destinationQuery,
    flightFilters.originQuery,
    mapFilters.flights.semaphore,
    flightSortDirection,
    flightSortKey,
  ])

  useEffect(() => {
    airportList.setScrollTop(0)
  }, [
    airportFilters.codeQuery,
    airportFilters.continentQuery,
    mapFilters.warehouses.semaphore,
    airportSortDirection,
    airportSortKey,
  ])

  useEffect(() => {
    shipmentList.setScrollTop(0)
  }, [
    selectedShipmentCategory,
    shipmentDestinationFilter,
    shipmentFlightFilter,
    shipmentOriginFilter,
    shipmentQuery,
    shipmentSortDirection,
    shipmentSortKey,
  ])

  const processedFocusRequestIdRef = useRef<number>(-1)

  useEffect(() => {
    if (!focusRequest || focusRequest.requestId === processedFocusRequestIdRef.current) return
    processedFocusRequestIdRef.current = focusRequest.requestId

    if (focusRequest.type === 'airport') {
      setActiveEntityTab('airports')
      setTimeout(() => {
        const index = displayedAirports.findIndex(a => a.codigoOaci === focusRequest.id)
        if (index !== -1) {
          const targetScrollTop = index * AIRPORT_ITEM_HEIGHT
          airportList.setScrollTop(targetScrollTop)
          if (airportListRef.current) {
            airportListRef.current.scrollTop = targetScrollTop
          }
        } else {
          airportList.setScrollTop(0)
          if (airportListRef.current) {
            airportListRef.current.scrollTop = 0
          }
        }
      }, 50)
      return
    }

    if (focusRequest.type === 'flight') {
      setActiveEntityTab('flights')
      setTimeout(() => {
        const index = orderedFlights.findIndex(f => f.flightId === Number(focusRequest.id))
        if (index !== -1) {
          const targetScrollTop = index * FLIGHT_ITEM_HEIGHT
          flightList.setScrollTop(targetScrollTop)
          if (flightListRef.current) {
            flightListRef.current.scrollTop = targetScrollTop
          }
        } else {
          flightList.setScrollTop(0)
          if (flightListRef.current) {
            flightListRef.current.scrollTop = 0
          }
        }
      }, 50)
      return
    }

    if (focusRequest.type === 'shipment') {
      setActiveEntityTab('shipments')
      setShipmentQuery(String(focusRequest.id))
      setTimeout(() => {
        const index = orderedShipmentItems.findIndex(s => s.codigoPedido === String(focusRequest.id))
        if (index !== -1) {
          const targetScrollTop = index * SHIPMENT_ITEM_HEIGHT
          shipmentList.setScrollTop(targetScrollTop)
          if (shipmentListRef.current) {
            shipmentListRef.current.scrollTop = targetScrollTop
          }
        } else {
          shipmentList.setScrollTop(0)
          if (shipmentListRef.current) {
            shipmentListRef.current.scrollTop = 0
          }
        }
      }, 50)
    }
  }, [focusRequest, displayedAirports, orderedFlights, orderedShipmentItems])

  const renderFlights = () => (
    <>
      <div className="flight-control-row">
        <label className="flight-search-field" aria-label="Buscar vuelo por código">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar código..."
            value={flightFilters.codeQuery}
            onChange={(event) => handleFlightFilterChange('codeQuery', event.target.value)}
            onKeyDown={handleFlightKeyDown}
          />
        </label>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button ${hasActiveFlightFilters ? 'active' : ''}`}
            onClick={() => {
              setIsFlightFilterMenuOpen((current) => !current)
              setIsFlightSortMenuOpen(false)
              setIsFlightSemaphoreMenuOpen(false)
            }}
            title="Filtros avanzados"
            aria-label="Filtros avanzados"
            aria-expanded={isFlightFilterMenuOpen}
          >
            <Filter size={18} />
            {hasActiveFlightFilters ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isFlightFilterMenuOpen && (
            <div className="flight-popover flight-filter-popover">
              <div className="flight-popover-title">Filtros avanzados</div>
              <label className="flight-popover-field">
                <span>Origen</span>
                <input
                  type="text"
                  list="flight-origin-options"
                  placeholder="Buscar origen..."
                  value={flightFilters.originQuery}
                  onChange={(event) => handleFlightFilterChange('originQuery', event.target.value)}
                />
              </label>
              <label className="flight-popover-field">
                <span>Destino</span>
                <input
                  type="text"
                  list="flight-destination-options"
                  placeholder="Buscar destino..."
                  value={flightFilters.destinationQuery}
                  onChange={(event) => handleFlightFilterChange('destinationQuery', event.target.value)}
                />
              </label>
              <button
                type="button"
                className="flight-popover-clear"
                onClick={clearFlightFilters}
                disabled={!hasActiveFlightFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button semaphore-tool-button ${hasActiveFlightSemaphoreFilter ? 'active' : ''}`}
            style={
              hasActiveFlightSemaphoreFilter
                ? ({
                    '--semaphore-active-bg': activeFlightSemaphoreColor.fill,
                    '--semaphore-active-border': activeFlightSemaphoreColor.stroke,
                  } as CSSProperties)
                : undefined
            }
            onClick={() => {
              setIsFlightSemaphoreMenuOpen((current) => !current)
              setIsFlightFilterMenuOpen(false)
              setIsFlightSortMenuOpen(false)
            }}
            title="Filtrar por semáforo"
            aria-label="Filtrar por semáforo"
            aria-expanded={isFlightSemaphoreMenuOpen}
          >
            <CircleDot size={18} />
            {hasActiveFlightSemaphoreFilter ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isFlightSemaphoreMenuOpen && (
            <div className="flight-popover flight-sort-popover semaphore-filter-popover">
              <div className="flight-popover-title">Semáforo de vuelos</div>
              {SEMAPHORE_OPTIONS.map((option) => {
                const colors = resolveSemaphoreColor(getSemaphoreOptionPercent(option, ranges), ranges)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={mapFilters.flights.semaphore === option.value ? 'active' : ''}
                    onClick={() => handleFlightSemaphoreFilterChange(option.value)}
                  >
                    <span
                      className="semaphore-filter-dot"
                      style={{ background: option.value === 'all' ? '#9aa8ba' : colors.fill }}
                    />
                    {option.label}
                  </button>
                )
              })}
              {mapFilterCounts ? (
                <div className="semaphore-filter-count">
                  {formatInteger(mapFilterCounts.flights)} vuelos visibles en mapa
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button ${hasActiveFlightSort ? 'active' : ''}`}
            onClick={() => {
              setIsFlightSortMenuOpen((current) => !current)
              setIsFlightFilterMenuOpen(false)
              setIsFlightSemaphoreMenuOpen(false)
            }}
            title="Ordenamiento"
            aria-label="Ordenamiento"
            aria-expanded={isFlightSortMenuOpen}
          >
            <ArrowUpDown size={18} />
            {hasActiveFlightSort ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isFlightSortMenuOpen && (
            <div className="flight-popover flight-sort-popover">
              <div className="flight-popover-title">Ordenar vuelos</div>
              <button
                type="button"
                className={flightSortKey === 'default' ? 'active' : ''}
                onClick={() => handleFlightSortPreset('default')}
              >
                Orden actual
              </button>
              <button
                type="button"
                className={flightSortKey === 'occupancy' && flightSortDirection === 'desc' ? 'active' : ''}
                onClick={() => handleFlightSortPreset('occupancy', 'desc')}
              >
                Capacidad
              </button>
              <button
                type="button"
                className={flightSortKey === 'departure' ? 'active' : ''}
                onClick={() => handleFlightSortPreset('departure', 'asc')}
              >
                Hora de salida
              </button>
              <button
                type="button"
                className={flightSortKey === 'arrival' ? 'active' : ''}
                onClick={() => handleFlightSortPreset('arrival', 'asc')}
              >
                Hora de llegada
              </button>
              <button
                type="button"
                className={flightSortKey === 'origin' ? 'active' : ''}
                onClick={() => handleFlightSortPreset('origin', 'asc')}
              >
                Origen
              </button>
              <button
                type="button"
                className={flightSortKey === 'destination' ? 'active' : ''}
                onClick={() => handleFlightSortPreset('destination', 'asc')}
              >
                Destino
              </button>
              <button
                type="button"
                className="flight-sort-direction-action"
                onClick={handleFlightSortDirectionToggle}
                disabled={flightSortKey === 'default'}
              >
                Dirección: {flightSortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
              </button>
            </div>
          )}
        </div>

        <datalist id="flight-origin-options">
          {flightFilterAirportOptions.map((airport) => (
            <option key={`origin-${airport.codigoOaci}`} value={airport.codigoOaci}>
              {airport.nombre}
            </option>
          ))}
        </datalist>
        <datalist id="flight-destination-options">
          {flightFilterAirportOptions.map((airport) => (
            <option key={`destination-${airport.codigoOaci}`} value={airport.codigoOaci}>
              {airport.nombre}
            </option>
          ))}
        </datalist>
      </div>
      <div
        ref={flightListRef}
        className="flight-list flight-card-list"
        onScroll={(event) =>
          flightList.setScrollTop(event.currentTarget.scrollTop)
        }
        style={{ height: `${flightList.listHeight}px` }}
      >
        <div
          className="flight-list-spacer"
          style={{ height: `${flightList.totalHeight}px` }}
        >
          <div
            className="flight-list-items"
            style={{ transform: `translateY(${flightList.offsetY}px)` }}
          >
            {flightList.visibleItems.map((flight) => {
              const displayFlightId = flight.planId ?? flight.flightId
              const hasCargo = flight.carga !== undefined && flight.capacidad !== undefined
              const capacityPercent = getFlightCapacityPercent(flight)
              const capacityPercentLabel = capacityPercent !== null ? formatPercent(capacityPercent, 0) : 'Sin dato'
              const capacityDetail = hasCargo
                ? `Capacidad: ${capacityPercentLabel} (${formatBags(flight.carga)} / ${formatBags(flight.capacidad)} maletas)`
                : flight.capacidad !== undefined
                  ? `Capacidad total: ${formatBags(flight.capacidad)} maletas`
                  : 'Capacidad: sin dato'
              const capacityColor = getFlightCapacityColor(flight)

              return (
                <button
                  key={flight.flightId}
                  className={`flight-item entity-flight-card ${selectedFlightId === flight.flightId ? "active" : ""}`}
                  onClick={() => onSelectFlight(flight.flightId)}
                  style={{
                    height: `${FLIGHT_ITEM_HEIGHT}px`,
                    '--capacity-color': capacityColor,
                  } as CSSProperties}
                >
                  <span className="flight-capacity-bar" aria-hidden="true" />
                  <div className="flight-card-content">
                    <div className="flight-card-header">
                      <span className="flight-label">{`${displayFlightId} | ${flight.origen} → ${flight.destino}`}</span>
                      {flight.estado ? <span className="flight-status-pill">{flight.estado}</span> : null}
                    </div>
                    <div className="flight-card-time flight-meta">
                      <Clock3 size={13} />
                      <span>
                        {formatMinuteRangeWithGmt(
                          flight.salidaMin,
                          flight.llegadaMin,
                          resolveAirportGmt(airportGmtByCode, flight.origen),
                          resolveAirportGmt(airportGmtByCode, flight.destino),
                        )}
                      </span>
                    </div>
                    <div className="flight-card-capacity">
                      {capacityDetail}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flight-hint">
        {labels?.flightHint ??
          `${formatInteger(orderedFlights.length)} ${labels?.flightHintNoun ?? "vuelos"}`}
      </div>
      {/* --- NUEVO CÓDIGO: PANEL DE MALETAS --- */}
      {selectedFlightId && (
        <div
          className="flight-list"
          style={{ maxHeight: "220px", height: "auto", marginTop: "10px" }}
        >
          <div
            style={{
              padding: "10px",
              fontSize: "12px",
              background: "#eaf0fb",
              borderBottom: "1px solid #d9e4f4",
            }}
          >
            <strong>Maletas del vuelo {selectedFlightLabel}</strong>
          </div>

          {loadingShipments && <div style={{ padding: "10px", fontSize: "12px" }}>Cargando maletas...</div>}
          {errorShipments && <div style={{ padding: "10px", fontSize: "12px", color: "red" }}>{errorShipments}</div>}

          {!loadingShipments && !errorShipments && flightShipments && (
            flightShipments.length === 0 ? (
              <div style={{ padding: "10px", fontSize: "12px" }}>No hay maletas registradas en este vuelo.</div>
            ) : (
              flightShipments.map((ship) => (
                <div
                  key={ship.id}
                  className="flight-item"
                  style={{
                    borderBottom: "1px solid rgba(217, 228, 244, 0.8)",
                    cursor: "default",
                    height: "auto",
                    padding: "8px 12px"
                  }}
                >
                  <div className="flight-label">
                    Pedido: {ship.codigoPedido}
                  </div>
                  <div className="flight-meta">
                    {ship.origen} → {ship.destino} | {formatBags(ship.cantidad)} maletas
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}
      {/* --- FIN NUEVO CÓDIGO --- */}
      <div className="cancelled-flights-toggle" style={{ marginTop: '12px', padding: '0 4px', borderTop: '1px solid #d9e4f4', paddingTop: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: '#1e3b67' }}>
          <input 
            type="checkbox" 
            checked={showCancelledDetails} 
            onChange={(e) => onShowCancelledDetailsChange?.(e.target.checked)}
          />
          Mostrar detalles de vuelos cancelados en el mapa
        </label>
      </div>
    </>
  );

  const renderShipments = () => (
    <div className={`shipment-sidebar-view ${sidebarView === 'bag-detail' ? 'is-bag-detail' : 'is-shipment-detail'}`}>
      {sidebarView === 'bag-detail' ? (
        <BagDetailPanel
          route={selectedBagRoute}
          airportGmtByCode={airportGmtByCode}
          selectedBagCode={selectedBagCode}
          clientId={selectedShipmentClientId}
          activeBagIndex={activeBagIndex}
          totalBags={selectedShipmentBagTotal}
          currentMinute={currentMinute}
          shipmentSearchError={shipmentSearchError}
          onPreviousBag={() => handleBagPagerChange(-1)}
          onNextBag={() => handleBagPagerChange(1)}
          onBack={handleBackToShipmentDetail}
        />
      ) : (
        <>
      {onSelectedShipmentCategoryChange && (
        <div className="shipment-category-selector">
          <button
            type="button"
            className={`shipment-category-button ${selectedShipmentCategory === 'PLANIFICADOS' ? 'active' : ''}`}
            onClick={() => onSelectedShipmentCategoryChange('PLANIFICADOS')}
          >
            {`Planificados (${formatInteger(shipmentsPlanificados.length)})`}
          </button>
          <button
            type="button"
            className={`shipment-category-button ${selectedShipmentCategory === 'EN_VUELO' ? 'active' : ''}`}
            onClick={() => onSelectedShipmentCategoryChange('EN_VUELO')}
          >
            {`En vuelo (${formatInteger(shipmentsEnVuelo.length)})`}
          </button>
          <button
            type="button"
            className={`shipment-category-button ${selectedShipmentCategory === 'ENTREGADOS' ? 'active' : ''}`}
            onClick={() => onSelectedShipmentCategoryChange('ENTREGADOS')}
          >
            {`Entregados (${formatInteger(shipmentsEntregados.length)})`}
          </button>
        </div>
      )}

      <div className="flight-control-row shipment-control-row">
        <label className="flight-search-field" aria-label="Buscar envío por ID">
          <Search size={16} />
          <input
            type="text"
            placeholder={labels?.shipmentPlaceholder ?? "Buscar ID..."}
            value={shipmentQuery}
            onChange={(event) => setShipmentQuery(event.target.value)}
            onKeyDown={handleShipmentKeyDown}
          />
        </label>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button ${hasActiveShipmentFilters ? 'active' : ''}`}
            onClick={() => {
              setIsShipmentFilterMenuOpen((current) => !current)
              setIsShipmentSortMenuOpen(false)
            }}
            title="Filtros avanzados"
            aria-label="Filtros avanzados"
            aria-expanded={isShipmentFilterMenuOpen}
          >
            <Filter size={18} />
            {hasActiveShipmentFilters ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isShipmentFilterMenuOpen && (
            <div className="flight-popover flight-filter-popover shipment-filter-popover">
              <div className="flight-popover-title">Filtros avanzados</div>
              <label className="flight-popover-field">
                <span>Origen</span>
                <input
                  type="text"
                  list="shipment-origin-options"
                  placeholder="Buscar origen..."
                  value={shipmentOriginFilter}
                  onChange={(event) => onShipmentOriginFilterChange?.(event.target.value.toUpperCase())}
                />
              </label>
              <label className="flight-popover-field">
                <span>Destino</span>
                <input
                  type="text"
                  list="shipment-destination-options"
                  placeholder="Buscar destino..."
                  value={shipmentDestinationFilter}
                  onChange={(event) => onShipmentDestinationFilterChange?.(event.target.value.toUpperCase())}
                />
              </label>
              <label className="flight-popover-field">
                <span>Código de vuelo</span>
                <input
                  type="text"
                  list="shipment-flight-options"
                  placeholder="Ej. 1024"
                  value={shipmentFlightFilter}
                  onChange={(event) => setShipmentFlightFilter(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="flight-popover-clear"
                onClick={clearShipmentFilters}
                disabled={!hasActiveShipmentFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button ${hasActiveShipmentSort ? 'active' : ''}`}
            onClick={() => {
              setIsShipmentSortMenuOpen((current) => !current)
              setIsShipmentFilterMenuOpen(false)
            }}
            title="Ordenamiento"
            aria-label="Ordenamiento"
            aria-expanded={isShipmentSortMenuOpen}
          >
            <ArrowUpDown size={18} />
            {hasActiveShipmentSort ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isShipmentSortMenuOpen && (
            <div className="flight-popover flight-sort-popover shipment-sort-popover">
              <div className="flight-popover-title">Ordenar envíos</div>
              <button
                type="button"
                className={shipmentSortKey === 'default' ? 'active' : ''}
                onClick={() => handleShipmentSortPreset('default')}
              >
                Orden actual
              </button>
              <button
                type="button"
                className={shipmentSortKey === 'bags' ? 'active' : ''}
                onClick={() => handleShipmentSortPreset('bags', 'desc')}
              >
                N° maletas
              </button>
              <button
                type="button"
                className={shipmentSortKey === 'departure' ? 'active' : ''}
                onClick={() => handleShipmentSortPreset('departure', 'asc')}
              >
                UT salida
              </button>
              <button
                type="button"
                className={shipmentSortKey === 'delivery' ? 'active' : ''}
                onClick={() => handleShipmentSortPreset('delivery', 'asc')}
              >
                Entrega
              </button>
              <button
                type="button"
                className={shipmentSortKey === 'origin' ? 'active' : ''}
                onClick={() => handleShipmentSortPreset('origin', 'asc')}
              >
                Origen
              </button>
              <button
                type="button"
                className={shipmentSortKey === 'destination' ? 'active' : ''}
                onClick={() => handleShipmentSortPreset('destination', 'asc')}
              >
                Destino
              </button>
              <button
                type="button"
                className="flight-sort-direction-action"
                onClick={handleShipmentSortDirectionToggle}
                disabled={shipmentSortKey === 'default'}
              >
                Dirección: {shipmentSortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
              </button>
            </div>
          )}
        </div>

        <datalist id="shipment-origin-options">
          {shipmentOriginOptions.map((origin) => (
            <option key={origin} value={origin} />
          ))}
        </datalist>
        <datalist id="shipment-destination-options">
          {shipmentDestinationOptions.map((destination) => (
            <option key={destination} value={destination} />
          ))}
        </datalist>
        <datalist id="shipment-flight-options">
          {shipmentFlightOptions.map((flightId) => (
            <option key={flightId} value={flightId} />
          ))}
        </datalist>
      </div>

      <label className="shipment-flight-filter-field" aria-label="Filtrar envíos por código de vuelo">
        <PlaneTakeoff size={14} />
        <input
          type="text"
          list="shipment-flight-options"
          placeholder="Filtrar por vuelo..."
          value={shipmentFlightFilter}
          onChange={(event) => setShipmentFlightFilter(event.target.value)}
        />
      </label>

      <div
        ref={shipmentListRef}
        className="flight-list shipment-card-list"
        onScroll={(event) =>
          shipmentList.setScrollTop(event.currentTarget.scrollTop)
        }
        style={{ height: `${shipmentList.listHeight}px` }}
      >
        <div
          className="flight-list-spacer"
          style={{ height: `${shipmentList.totalHeight}px` }}
        >
          <div
            className="flight-list-items"
            style={{ transform: `translateY(${shipmentList.offsetY}px)` }}
          >
            {shipmentList.visibleItems.length === 0 && (
              <div className="shipment-empty-card">
                {labels?.shipmentEmpty ?? "No hay muestras (inicia simulación)"}
              </div>
            )}
            {shipmentList.visibleItems.map((shipment) => {
              const codigo = shipment.codigoPedido
              const cantidad = shipment.cantidadMaletas ?? shipmentQuantities[codigo] ?? 0
              const isExpanded = expandedShipmentCode === codigo
              const isSelected = selectedShipmentRoute?.codigoPedido === codigo
              const deliveryLabel = shipment.minutoEntrega !== null && shipment.minutoEntrega !== undefined
                ? formatSimDateTimeFromMinuteWithGmt(
                    shipment.minutoEntrega,
                    resolveAirportGmt(airportGmtByCode, shipment.destino),
                  )
                : '--'

              return (
                <div
                  key={codigo}
                  className={`flight-item entity-shipment-card ${isSelected ? "active" : ""}`}
                  style={{ height: `${SHIPMENT_ITEM_HEIGHT}px` }}
                  role="button"
                  tabIndex={0}
                  title="Click para ver la ruta completa"
                  onClick={() => handleSelectShipment(codigo)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelectShipment(codigo)
                    }
                  }}
                >
                  <div className="shipment-card-content">
                    <div className="shipment-card-header">
                      <span className="flight-label">{codigo}</span>
                      <span className="shipment-status-pill">{getShipmentStatusLabel(shipment.estado)}</span>
                    </div>
                    <div className="shipment-card-route">
                      <MapPin size={13} />
                      <span>{`${shipment.origen || '--'} → ${shipment.destino || '--'}`}</span>
                    </div>
                    <div className="shipment-card-metrics">
                      <span>
                        <Package size={13} />
                        {`${formatBags(cantidad)} maletas`}
                      </span>
                      {cantidad ? (
                        <button
                          type="button"
                          className="shipment-card-bag-toggle"
                          onClick={(event) => {
                            event.stopPropagation()
                            setExpandedShipmentCode(isExpanded ? null : codigo)
                          }}
                          title={isExpanded ? 'Ocultar maletas' : 'Ver maletas'}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver'}
                        </button>
                      ) : null}
                    </div>
                    <div className="shipment-card-footer">
                      <span>
                        {`Salida: ${formatShipmentDepartureTime(
                          shipment.ut,
                          resolveAirportGmt(airportGmtByCode, shipment.origen),
                        )}`}
                      </span>
                      <span>{`Entrega: ${deliveryLabel}`}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {selectedShipmentCodeForBags && selectedShipmentBagTotal ? (
        <BagList
          shipmentCode={selectedShipmentCodeForBags}
          totalBags={selectedShipmentBagTotal}
          selectedBagCode={selectedBagCode}
          onSelectBag={handleSelectBag}
        />
      ) : null}
      <div className="flight-hint">
        {labels?.shipmentHint ??
          `${formatInteger(orderedShipmentItems.length)} ${labels?.shipmentHintNoun ?? "envíos"}`}
      </div>
      {shipmentSearchError && (
        <div className="upload-error" style={{ marginBottom: "8px" }}>
          {shipmentSearchError}
        </div>
      )}
      {selectedShipmentRoute && (
        <div
          className="flight-list"
          style={{ maxHeight: "220px", height: "auto", marginBottom: "10px" }}
        >
          <div
            style={{
              padding: "10px",
              fontSize: "12px",
              background: "#eaf0fb",
              borderBottom: "1px solid #d9e4f4",
            }}
          >
            <strong>Estado:</strong>{" "}
            {getDynamicShipmentStatus(selectedShipmentRoute, currentMinute)}{" "}
            <br />
            <strong>Tiempo total:</strong>{" "}
            {formatDurationHours(selectedShipmentRoute.tiempoTotalHoras)}
          </div>
          {selectedShipmentRoute.ruta.length === 0 && (
            <div style={{ padding: "10px", fontSize: "12px" }}>
              No hay saltos registrados.
            </div>
          )}
          {selectedShipmentRoute.ruta.map((step, index) => (
            <div
              key={`${step.vueloId}-${step.origen}-${step.destino}-${index}`}
              className="flight-item"
              style={{
                borderBottom: "1px solid rgba(217, 228, 244, 0.8)",
                cursor: "default",
              }}
            >
              <div className="flight-label">
                {step.planId ?? step.vueloId} | {step.origen} → {step.destino}
              </div>
              <div className="flight-meta">
                Salida {
                  formatMinuteRangeWithGmt(
                    step.salidaMin,
                    step.llegadaMin,
                    resolveAirportGmt(airportGmtByCode, step.origen),
                    resolveAirportGmt(airportGmtByCode, step.destino),
                  )
                }
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );

  const renderAirports = () => (
    <>
      <div className="flight-control-row airport-control-row">
        <label className="flight-search-field" aria-label="Buscar aeropuerto por código">
          <Search size={16} />
          <input
            type="text"
            placeholder={labels?.airportPlaceholder ?? 'Buscar código...'}
            value={airportFilters.codeQuery}
            onChange={(event) => handleAirportFilterChange('codeQuery', event.target.value)}
            onKeyDown={handleAirportKeyDown}
          />
        </label>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button ${hasActiveAirportFilters ? 'active' : ''}`}
            onClick={() => {
              setIsAirportFilterMenuOpen((current) => !current)
              setIsAirportSortMenuOpen(false)
              setIsAirportSemaphoreMenuOpen(false)
            }}
            title="Filtros avanzados"
            aria-label="Filtros avanzados"
            aria-expanded={isAirportFilterMenuOpen}
          >
            <Filter size={18} />
            {hasActiveAirportFilters ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isAirportFilterMenuOpen && (
            <div className="flight-popover airport-filter-popover">
              <div className="flight-popover-title">Filtros avanzados</div>
              <label className="flight-popover-field">
                <span>Región continental</span>
                <input
                  type="text"
                  list="airport-continent-options"
                  placeholder="Buscar región..."
                  value={selectedAirportContinentValue || airportFilters.continentQuery}
                  onChange={(event) => handleAirportFilterChange('continentQuery', event.target.value)}
                />
              </label>
              <button
                type="button"
                className="flight-popover-clear"
                onClick={clearAirportFilters}
                disabled={!hasActiveAirportFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button semaphore-tool-button ${hasActiveAirportSemaphoreFilter ? 'active' : ''}`}
            style={
              hasActiveAirportSemaphoreFilter
                ? ({
                    '--semaphore-active-bg': activeAirportSemaphoreColor.fill,
                    '--semaphore-active-border': activeAirportSemaphoreColor.stroke,
                  } as CSSProperties)
                : undefined
            }
            onClick={() => {
              setIsAirportSemaphoreMenuOpen((current) => !current)
              setIsAirportFilterMenuOpen(false)
              setIsAirportSortMenuOpen(false)
            }}
            title="Filtrar por semáforo"
            aria-label="Filtrar por semáforo"
            aria-expanded={isAirportSemaphoreMenuOpen}
          >
            <CircleDot size={18} />
            {hasActiveAirportSemaphoreFilter ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isAirportSemaphoreMenuOpen && (
            <div className="flight-popover flight-sort-popover semaphore-filter-popover">
              <div className="flight-popover-title">Semáforo de aeropuertos</div>
              {SEMAPHORE_OPTIONS.map((option) => {
                const colors = resolveSemaphoreColor(getSemaphoreOptionPercent(option, ranges), ranges)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={mapFilters.warehouses.semaphore === option.value ? 'active' : ''}
                    onClick={() => handleAirportSemaphoreFilterChange(option.value)}
                  >
                    <span
                      className="semaphore-filter-dot"
                      style={{ background: option.value === 'all' ? '#9aa8ba' : colors.fill }}
                    />
                    {option.label}
                  </button>
                )
              })}
              {mapFilterCounts ? (
                <div className="semaphore-filter-count">
                  {formatInteger(mapFilterCounts.warehouses)} aeropuertos visibles en mapa
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flight-tool-wrap">
          <button
            type="button"
            className={`flight-tool-button ${hasActiveAirportSort ? 'active' : ''}`}
            onClick={() => {
              setIsAirportSortMenuOpen((current) => !current)
              setIsAirportFilterMenuOpen(false)
              setIsAirportSemaphoreMenuOpen(false)
            }}
            title="Ordenamiento"
            aria-label="Ordenamiento"
            aria-expanded={isAirportSortMenuOpen}
          >
            <ArrowUpDown size={18} />
            {hasActiveAirportSort ? <span className="flight-tool-indicator" /> : null}
          </button>

          {isAirportSortMenuOpen && (
            <div className="flight-popover flight-sort-popover airport-sort-popover">
              <div className="flight-popover-title">Ordenar aeropuertos</div>
              <button
                type="button"
                className={!hasActiveAirportSort ? 'active' : ''}
                onClick={() => handleAirportSortPreset('occupancy', 'desc')}
              >
                Orden actual
              </button>
              <button
                type="button"
                className={hasActiveAirportSort && airportSortKey === 'occupancy' ? 'active' : ''}
                onClick={() => handleAirportSortPreset('occupancy', 'desc')}
              >
                Ocupación
              </button>
              <button
                type="button"
                className={airportSortKey === 'departure' ? 'active' : ''}
                onClick={() => handleAirportSortPreset('departure', 'asc')}
              >
                Próxima salida
              </button>
              <button
                type="button"
                className={airportSortKey === 'arrival' ? 'active' : ''}
                onClick={() => handleAirportSortPreset('arrival', 'asc')}
              >
                Próxima llegada
              </button>
              <button
                type="button"
                className="flight-sort-direction-action"
                onClick={handleAirportSortDirectionToggle}
              >
                Dirección: {airportSortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
              </button>
            </div>
          )}
        </div>

        <datalist id="airport-continent-options">
          {airportContinentOptions.map((continent) => (
            <option key={continent} value={continent} />
          ))}
        </datalist>
      </div>
      <div
        ref={airportListRef}
        className="flight-list airport-card-list"
        onScroll={(event) =>
          airportList.setScrollTop(event.currentTarget.scrollTop)
        }
        style={{ height: `${airportList.listHeight}px` }}
      >
        <div
          className="flight-list-spacer"
          style={{ height: `${airportList.totalHeight}px` }}
        >
          <div
            className="flight-list-items"
            style={{ transform: `translateY(${airportList.offsetY}px)` }}
          >
            {airportList.visibleItems.map((airport) => {
              const hasOccupancy = airport.ocupacion !== undefined && airport.capacidad !== undefined
              const occupancyPercentLabel = airport.porcentaje !== undefined
                ? formatPercent(airport.porcentaje, 0)
                : 'Sin dato'
              const occupancyDetail = hasOccupancy
                ? `Ocupación: ${occupancyPercentLabel} (${formatInteger(airport.ocupacion)} / ${formatInteger(airport.capacidad)} maletas)`
                : airport.capacidad !== undefined
                  ? `Capacidad total: ${formatInteger(airport.capacidad)} maletas`
                  : 'Ocupación: sin dato'
              const occupancyColor = getAirportOccupancyColor(airport)

              return (
                <button
                  key={airport.codigoOaci}
                  className={`flight-item entity-airport-card ${selectedAirportCode === airport.codigoOaci ? "active" : ""}`}
                  onClick={() => onSelectAirport(airport.codigoOaci)}
                  style={{
                    height: `${AIRPORT_ITEM_HEIGHT}px`,
                    '--airport-occupancy-color': occupancyColor,
                  } as CSSProperties}
                >
                  <span className="airport-occupancy-bar" aria-hidden="true" />
                  <div className="airport-card-content">
                    <div className="airport-card-header">
                      <span className="flight-label">{`${airport.codigoOaci} | ${airport.nombre}`}</span>
                    </div>
                    <div className="airport-card-location flight-meta">
                      <MapPin size={13} />
                      <span>{[airport.pais, airport.continente].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="airport-card-timings">
                      <span>
                        <PlaneTakeoff size={13} />
                        {formatSimMinuteWithGmt(
                          airport.nextDepartureMin,
                          resolveAirportGmt(airportGmtByCode, airport.codigoOaci),
                          true,
                        )}
                      </span>
                      <span>
                        <PlaneLanding size={13} />
                        {formatSimMinuteWithGmt(
                          airport.nextArrivalMin,
                          resolveAirportGmt(airportGmtByCode, airport.codigoOaci),
                          true,
                        )}
                      </span>
                    </div>
                    <div className="airport-card-capacity">
                      {occupancyDetail}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flight-hint">
        {labels?.airportHint ??
          (
            airportCodeQuery || airportContinentQuery
              ? `${formatInteger(filteredAirports.length)} ${labels?.airportHintNoun ?? "almacenes"}`
              : `Mostrando ${formatInteger(displayedAirports.length)} de ${formatInteger(filteredAirports.length)} ${labels?.airportHintNoun ?? "almacenes"}`
          )}
      </div>
    </>
  );

  return (
    <>
      <div className="entity-subtabs sticky-subtabs">
        <button
          className={`entity-subtab ${activeEntityTab === "flights" ? "active" : ""} ${filteredFlights.length === 0 ? "empty" : ""}`}
          onClick={() => setActiveEntityTab("flights")}
        >
          {`Vuelos (${formatInteger(filteredFlights.length)})`}
        </button>
        <button
          className={`entity-subtab ${activeEntityTab === "shipments" ? "active" : ""} ${filteredShipmentItems.length === 0 ? "empty" : ""}`}
          onClick={() => setActiveEntityTab("shipments")}
        >
          {`Envíos (${formatInteger(filteredShipmentItems.length)})`}
        </button>
        <button
          className={`entity-subtab ${activeEntityTab === "airports" ? "active" : ""} ${filteredAirports.length === 0 ? "empty" : ""}`}
          onClick={() => setActiveEntityTab("airports")}
        >
          {`Aeropuertos (${formatInteger(filteredAirports.length)})`}
        </button>
      </div>

      {activeEntityTab === "flights" ? renderFlights() : null}
      {activeEntityTab === "shipments" ? renderShipments() : null}
      {activeEntityTab === "airports" ? renderAirports() : null}
    </>
  );
}
