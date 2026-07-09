import { RotateCcw } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import useVirtualList from '../hooks/useVirtualList'
import type { EntityFocusRequest } from '../types/entityFocus'
import type { AirportTextFilters, FlightTextFilters } from '../types/mapFilters'
import type { ShipmentCrudDto } from '../types/sim'
// 1. Asegúrate de importar la función de simulación desde tu api
import { getShipmentsByFlight, getSimulationShipmentsByFlight, type EnvioDetalleDto } from '../services/api'
import './EntityExplorer.css'

// 2. Importa el hook del contexto de simulación
import { useSimulationContext } from '../contexts/SimulationContext'

import {
  formatDurationHours,
  formatBags,
  formatInteger,
  formatMinuteRange,
  formatOperationalMinuteRange,
  formatPercent,
  formatSimMinute,
} from '../utils/time'

export type EntityTab = 'flights' | 'shipments' | 'airports'

export type EntityFlightItem = {
  flightId: number
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

export type ShipmentCategory = 'PLANIFICADOS' | 'EN_VUELO' | 'ENTREGADOS'

export type EntityExplorerProps = {
  flights: EntityFlightItem[]
  airports: EntityAirportItem[]
  shipments: string[]
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute: EntityShipmentRoute | null
  onSelectFlight: (flightId: number) => void
  onSelectAirport: (codigoOaci: string) => void
  flightFilters: FlightTextFilters
  onFlightFiltersChange: (filters: FlightTextFilters) => void
  airportFilters: AirportTextFilters
  onAirportFiltersChange: (filters: AirportTextFilters) => void
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  currentMinute: number | null
  focusRequest?: EntityFocusRequest | null
  shipmentQuantities?: Record<string, number>
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

type SortDirection = 'asc' | 'desc'

const ITEM_HEIGHT = 44
const FLIGHT_ITEM_HEIGHT = 56
const AIRPORT_ITEM_HEIGHT = 92
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

export default function EntityExplorer({
  flights,
  airports,
  shipments,
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentRoute,
  onSelectFlight,
  onSelectAirport,
  flightFilters,
  onFlightFiltersChange,
  airportFilters,
  onAirportFiltersChange,
  onSearchShipment,
  shipmentSearchError,
  currentMinute,
  focusRequest,
  shipmentQuantities = {},
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
  void currentMinute
  void getDynamicShipmentStatus
  const flightListRef = useRef<HTMLDivElement>(null)
  const airportListRef = useRef<HTMLDivElement>(null)
  const shipmentListRef = useRef<HTMLDivElement>(null)

  const [activeEntityTab, setActiveEntityTab] = useState<EntityTab>("flights");
  const [flightSortKey, setFlightSortKey] = useState<FlightSortKey>('default')
  const [flightSortDirection, setFlightSortDirection] = useState<SortDirection>('asc')
  const [airportSortKey, setAirportSortKey] = useState<AirportSortKey>('occupancy')
  const [airportSortDirection, setAirportSortDirection] = useState<SortDirection>('desc')
  const [shipmentQuery, setShipmentQuery] = useState("");
  const [expandedShipmentCode, setExpandedShipmentCode] = useState<string | null>(null);

  const { simulation } = useSimulationContext();
  const simId = simulation.simId;

  const [flightShipments, setFlightShipments] = useState<ShipmentCrudDto[] | null>(null);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [errorShipments, setErrorShipments] = useState<string | null>(null);

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
      ? getSimulationShipmentsByFlight(simId, selectedFlightId)
      : getShipmentsByFlight(selectedFlightId);

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
  }, [selectedFlightId, simId]); // 3. ⚠️ Añadimos 'simId' aquí para que reaccione si cambia la simulación
  // --- FIN CÓDIGO ACTUALIZADO ---

  const filteredFlights = useMemo(() => {
    const codeQuery = flightFilters.codeQuery.trim().toLowerCase()
    const originQuery = flightFilters.originQuery.trim().toLowerCase()
    const destinationQuery = flightFilters.destinationQuery.trim().toLowerCase()

    return flights.filter((flight) => {
      if (codeQuery && !String(flight.flightId).toLowerCase().includes(codeQuery)) {
        return false
      }

      if (originQuery && !flight.origen.toLowerCase().includes(originQuery)) {
        return false
      }

      if (destinationQuery && !flight.destino.toLowerCase().includes(destinationQuery)) {
        return false
      }

      return true
    })
  }, [flightFilters.codeQuery, flightFilters.destinationQuery, flightFilters.originQuery, flights]);

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

      return left.flightId - right.flightId
    })
  }, [filteredFlights, flightSortDirection, flightSortKey]);

  const airportCodeQuery = airportFilters.codeQuery.trim().toLowerCase()
  const airportContinentQuery = airportFilters.continentQuery.trim().toLowerCase()

  const filteredAirports = useMemo(() => {
    return airports.filter((airport) => {
      if (airportCodeQuery && !airport.codigoOaci.toLowerCase().includes(airportCodeQuery)) {
        return false
      }

      if (
        airportContinentQuery &&
        (airport.continente ?? '').trim().toLowerCase() !== airportContinentQuery
      ) {
        return false
      }

      return true
    })
  }, [airportCodeQuery, airportContinentQuery, airports]);

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

  const filteredShipments = useMemo(() => {
    const query = shipmentQuery.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((shipment) =>
      shipment.toLowerCase().includes(query),
    );
  }, [shipments, shipmentQuery]);

  const flightList = useVirtualList(orderedFlights, {
    itemHeight: FLIGHT_ITEM_HEIGHT,
    listHeight,
  });
  const airportList = useVirtualList(displayedAirports, {
    itemHeight: AIRPORT_ITEM_HEIGHT,
    listHeight,
  });
  const shipmentList = useVirtualList(filteredShipments, {
    itemHeight: ITEM_HEIGHT,
    listHeight: shipmentListHeight,
  });
  const selectedShipmentCodeForBags =
    expandedShipmentCode
    ?? (
      selectedShipmentRoute?.codigoPedido && shipmentQuantities[selectedShipmentRoute.codigoPedido]
        ? selectedShipmentRoute.codigoPedido
        : null
    )

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

  const handleFlightSortChange = (value: FlightSortKey) => {
    setFlightSortKey(value)
    setFlightSortDirection(FLIGHT_SORT_DEFAULT_DIRECTION[value])
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

  const handleAirportSortChange = (value: AirportSortKey) => {
    setAirportSortKey(value)
    setAirportSortDirection(AIRPORT_SORT_DEFAULT_DIRECTION[value])
    airportList.setScrollTop(0)
  }

  const handleAirportSortDirectionToggle = () => {
    setAirportSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    airportList.setScrollTop(0)
  }

  useEffect(() => {
    flightList.setScrollTop(0)
  }, [
    flightFilters.codeQuery,
    flightFilters.destinationQuery,
    flightFilters.originQuery,
    flightSortDirection,
    flightSortKey,
  ])

  useEffect(() => {
    airportList.setScrollTop(0)
  }, [
    airportFilters.codeQuery,
    airportFilters.continentQuery,
    airportSortDirection,
    airportSortKey,
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
        const index = filteredShipments.findIndex(s => s === String(focusRequest.id))
        if (index !== -1) {
          const targetScrollTop = index * ITEM_HEIGHT
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
  }, [focusRequest, displayedAirports, orderedFlights, filteredShipments])

  const renderShipmentCategoryTable = (
    title: string,
    items: EnvioDetalleDto[],
    showDeliveryMinute: boolean,
  ) => (
    <div className="entity-shipment-category" style={{ marginBottom: "14px" }}>
      <div className="entity-toolbar-label" style={{ marginBottom: "4px" }}>
        {`${title} (${formatInteger(items.length)})`}
      </div>
      <div
        className="flight-list"
        style={{ maxHeight: "180px", height: "auto", overflowY: "auto" }}
      >
        {items.length === 0 ? (
          <div style={{ padding: "10px", fontSize: "12px" }}>
            Sin envíos en esta categoría.
          </div>
        ) : (
          <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#eaf0fb" }}>
                <th style={{ padding: "6px" }}>Código de pedido</th>
                <th style={{ padding: "6px" }}>Origen actual</th>
                <th style={{ padding: "6px" }}>Destino final</th>
                <th style={{ padding: "6px" }}>UT salida</th>
                <th style={{ padding: "6px" }}>N° maletas</th>
                {showDeliveryMinute && <th style={{ padding: "6px" }}>Entrega (min)</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isExpanded = expandedShipmentCode === item.codigoPedido
                const bagCodes = buildBagCodes(item.codigoPedido, item.cantidadMaletas)

                return (
                  <Fragment key={item.codigoPedido}>
                    <tr
                      key={item.codigoPedido}
                      style={{
                        borderBottom: "1px solid rgba(217, 228, 244, 0.8)",
                      }}
                      title="Click para ver la ruta completa"
                    >
                      <td style={{ padding: "6px" }}>
                        <button
                          type="button"
                          className="entity-link-button"
                          onClick={() => onSearchShipment(item.codigoPedido)}
                        >
                          {item.codigoPedido}
                        </button>
                      </td>
                      <td style={{ padding: "6px" }}>{item.origen}</td>
                      <td style={{ padding: "6px" }}>{item.destino}</td>
                      <td style={{ padding: "6px" }}>{item.ut}</td>
                      <td style={{ padding: "6px" }}>
                        <button
                          type="button"
                          className="entity-bag-toggle"
                          onClick={() => setExpandedShipmentCode(isExpanded ? null : item.codigoPedido)}
                        >
                          {formatBags(item.cantidadMaletas)}
                        </button>
                      </td>
                      {showDeliveryMinute && (
                        <td style={{ padding: "6px" }}>
                          {item.minutoEntrega ?? "-"}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.codigoPedido}-bags`}>
                        <td colSpan={showDeliveryMinute ? 6 : 5} style={{ padding: "8px 6px 10px" }}>
                          <div className="entity-bag-list">
                            {bagCodes.map((bagCode) => (
                              <button
                                key={bagCode}
                                type="button"
                                className="entity-bag-chip"
                                onClick={() => onSearchShipment(bagCode)}
                              >
                                {bagCode}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderFlights = () => (
    <>
      <div className="entity-filter-panel">
        <div className="entity-filter-header">
          <span className="entity-toolbar-label">Filtros de vuelos</span>
          <button
            type="button"
            className="entity-filter-clear"
            onClick={clearFlightFilters}
            disabled={
              !flightFilters.codeQuery &&
              !flightFilters.originQuery &&
              !flightFilters.destinationQuery
            }
            title="Limpiar filtros"
          >
            <span>Limpiar</span>
          </button>
        </div>
        <div className="entity-filter-grid">
          <label className="field">
            <span className="entity-filter-label">Código</span>
            <input
              type="text"
              placeholder={labels?.flightPlaceholder ?? "Ej. 1024"}
              value={flightFilters.codeQuery}
              onChange={(event) => handleFlightFilterChange('codeQuery', event.target.value)}
              onKeyDown={handleFlightKeyDown}
            />
          </label>
          <label className="field">
            <span className="entity-filter-label">Origen</span>
            <select
              value={flightFilters.originQuery}
              onChange={(event) => handleFlightFilterChange('originQuery', event.target.value)}
            >
              <option value="">Todos</option>
              {flightFilterAirportOptions.map((airport) => (
                <option key={`origin-${airport.codigoOaci}`} value={airport.codigoOaci}>
                  {`${airport.codigoOaci} · ${airport.nombre}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="entity-filter-label">Destino</span>
            <select
              value={flightFilters.destinationQuery}
              onChange={(event) => handleFlightFilterChange('destinationQuery', event.target.value)}
            >
              <option value="">Todos</option>
              {flightFilterAirportOptions.map((airport) => (
                <option key={`destination-${airport.codigoOaci}`} value={airport.codigoOaci}>
                  {`${airport.codigoOaci} · ${airport.nombre}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="entity-toolbar">
        <label className="field entity-sort-field">
          <span className="entity-toolbar-label">Ordenar por</span>
          <div className="entity-sort-row">
            <select
              value={flightSortKey}
              onChange={(event) => handleFlightSortChange(event.target.value as FlightSortKey)}
            >
              <option value="default">Orden actual</option>
              <option value="occupancy">Nivel de ocupación</option>
              <option value="departure">Hora de salida</option>
              <option value="arrival">Hora de llegada</option>
              <option value="origin">Origen</option>
              <option value="destination">Destino</option>
            </select>
            <button
              type="button"
              className="entity-sort-direction"
              onClick={handleFlightSortDirectionToggle}
              disabled={flightSortKey === 'default'}
              title={
                flightSortKey === 'default'
                  ? 'Selecciona un criterio para activar el orden'
                  : flightSortDirection === 'asc'
                    ? 'Cambiar a descendente'
                    : 'Cambiar a ascendente'
              }
            >
              {flightSortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </label>
      </div>
      <div
        ref={flightListRef}
        className="flight-list"
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
              const hasCargo = flight.carga !== undefined && flight.capacidad !== undefined
              const cargoLabel = hasCargo
                ? `${formatBags(flight.carga)} / ${formatBags(flight.capacidad)}`
                : flight.capacidad !== undefined
                  ? `Cap. ${formatBags(flight.capacidad)}`
                  : null

              return (
                <button
                  key={flight.flightId}
                  className={`flight-item entity-flight-item ${selectedFlightId === flight.flightId ? "active" : ""}`}
                  onClick={() => onSelectFlight(flight.flightId)}
                  style={{ height: `${FLIGHT_ITEM_HEIGHT}px` }}
                >
                  <div>
                    <div className="flight-label">{`${flight.flightId} | ${flight.origen} → ${flight.destino}`}</div>
                    <div className="flight-meta">
                      {`${flight.estado ? `${flight.estado} · ` : ""} ${formatMinuteRange(flight.salidaMin, flight.llegadaMin)}`}
                    </div>
                    <div className="flight-meta">
                      {cargoLabel ? cargoLabel : ""}
                    </div>
                  </div>
                  {flight.porcentaje !== undefined ? (
                    <div className="entity-airport-status">
                      <span>{formatPercent(flight.porcentaje, 0)}</span>
                      <span
                        className="warehouse-dot"
                        style={{ background: flight.color }}
                      />
                    </div>
                  ) : null}
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
            <strong>📦 Maletas del vuelo {selectedFlightId}</strong>
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
    <>
      {onSelectedShipmentCategoryChange && (
        <div className="shipment-category-selector" style={{ marginBottom: '15px', display: 'flex' }}>
          <button
            className={`category-btn ${selectedShipmentCategory === 'PLANIFICADOS' ? 'active' : ''}`}
            onClick={() => onSelectedShipmentCategoryChange('PLANIFICADOS')}
            style={{
              flex: 1,
              padding: '8px',
              marginRight: '5px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: selectedShipmentCategory === 'PLANIFICADOS' ? '#0288d1' : '#f5f5f5',
              color: selectedShipmentCategory === 'PLANIFICADOS' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: selectedShipmentCategory === 'PLANIFICADOS' ? 'bold' : 'normal',
            }}
          >
            Planificados
          </button>
          <button
            className={`category-btn ${selectedShipmentCategory === 'EN_VUELO' ? 'active' : ''}`}
            onClick={() => onSelectedShipmentCategoryChange('EN_VUELO')}
            style={{
              flex: 1,
              padding: '8px',
              marginRight: '5px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: selectedShipmentCategory === 'EN_VUELO' ? '#0288d1' : '#f5f5f5',
              color: selectedShipmentCategory === 'EN_VUELO' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: selectedShipmentCategory === 'EN_VUELO' ? 'bold' : 'normal',
            }}
          >
            En Vuelo
          </button>
          <button
            className={`category-btn ${selectedShipmentCategory === 'ENTREGADOS' ? 'active' : ''}`}
            onClick={() => onSelectedShipmentCategoryChange('ENTREGADOS')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: selectedShipmentCategory === 'ENTREGADOS' ? '#0288d1' : '#f5f5f5',
              color: selectedShipmentCategory === 'ENTREGADOS' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: selectedShipmentCategory === 'ENTREGADOS' ? 'bold' : 'normal',
            }}
          >
            Entregados
          </button>
        </div>
      )}

      {/* Filtros de origen y destino */}
      {onShipmentOriginFilterChange && (
        <label className="field" style={{ marginBottom: '10px' }}>
          <span className="entity-filter-label">Filtrar por Origen</span>
          <input
            type="text"
            placeholder="Ej. LIM"
            value={shipmentOriginFilter}
            onChange={(event) => onShipmentOriginFilterChange(event.target.value.toUpperCase())}
          />
        </label>
      )}
      {onShipmentDestinationFilterChange && (
        <label className="field" style={{ marginBottom: '15px' }}>
          <span className="entity-filter-label">Filtrar por Destino</span>
          <input
            type="text"
            placeholder="Ej. SKBO"
            value={shipmentDestinationFilter}
            onChange={(event) => onShipmentDestinationFilterChange(event.target.value.toUpperCase())}
          />
        </label>
      )}

      {selectedShipmentCategory === 'PLANIFICADOS' && renderShipmentCategoryTable("Planificados", shipmentsPlanificados, false)}
      {selectedShipmentCategory === 'EN_VUELO' && renderShipmentCategoryTable("En Vuelo", shipmentsEnVuelo, false)}
      {selectedShipmentCategory === 'ENTREGADOS' && renderShipmentCategoryTable("Entregados Recientes", shipmentsEntregados, true)}

      <h3>{labels?.shipmentTitle ?? "Buscar envío / maleta"}</h3>
      <label className="field">
        <input
          type="text"
          placeholder={
            labels?.shipmentPlaceholder ??
            "Ingresar ID del envío (ej. 000000001)"
          }
          value={shipmentQuery}
          onChange={(event) => setShipmentQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearchShipment(shipmentQuery);
          }}
        />
      </label>

      <div
        ref={shipmentListRef}
        className="flight-list"
        onScroll={(event) =>
          shipmentList.setScrollTop(event.currentTarget.scrollTop)
        }
        style={{ height: `${shipmentList.listHeight}px`, marginTop: "8px" }}
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
              <div style={{ padding: "10px", fontSize: "12px" }}>
                {labels?.shipmentEmpty ?? "No hay muestras (inicia simulación)"}
              </div>
            )}
            {shipmentList.visibleItems.map((codigo) => {
              const cantidad = shipmentQuantities[codigo]
              const isExpanded = expandedShipmentCode === codigo
              return (
                <div
                  key={codigo}
                  className={`flight-item entity-shipment-list-item ${selectedShipmentRoute?.codigoPedido === codigo ? "active" : ""}`}
                  style={{ height: `${ITEM_HEIGHT}px` }}
                >
                  <button
                    type="button"
                    className="entity-shipment-main"
                    onClick={() => onSearchShipment(codigo)}
                  >
                    <div className="flight-label">{`${labels?.shipmentIcon ?? "📦"} Pedido: ${codigo}`}</div>
                    <div className="flight-meta">
                      {cantidad ? `${formatBags(cantidad)} maletas` : 'Click para ver ruta'}
                    </div>
                  </button>
                  {cantidad ? (
                    <button
                      type="button"
                      className="entity-bag-toggle"
                      onClick={() => setExpandedShipmentCode(isExpanded ? null : codigo)}
                      title={isExpanded ? 'Ocultar maletas' : 'Ver maletas'}
                    >
                      {isExpanded ? 'Ocultar' : 'Ver'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {selectedShipmentCodeForBags && shipmentQuantities[selectedShipmentCodeForBags] ? (
        <div className="entity-bag-panel">
          <div className="entity-toolbar-label">
            Maletas de {selectedShipmentCodeForBags}
          </div>
          <div className="entity-bag-list">
            {buildBagCodes(selectedShipmentCodeForBags, shipmentQuantities[selectedShipmentCodeForBags]).map((bagCode) => (
              <button
                key={bagCode}
                type="button"
                className="entity-bag-chip"
                onClick={() => onSearchShipment(bagCode)}
              >
                {bagCode}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flight-hint">
        {labels?.shipmentHint ??
          `${formatInteger(filteredShipments.length)} ${labels?.shipmentHintNoun ?? "envíos de muestra"}`}
      </div>

      <div
        className="buttons"
        style={{ marginTop: "4px", marginBottom: "4px" }}
      >
        <button className="btn" onClick={() => onSearchShipment(shipmentQuery)}>
          Buscar ruta
        </button>
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
                {step.vueloId} | {step.origen} → {step.destino}
              </div>
              <div className="flight-meta">
                Salida {formatOperationalMinuteRange(step.salidaMin, step.llegadaMin)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderAirports = () => (
    <>
      <div className="entity-filter-panel">
        <div className="entity-filter-header">
          <span className="entity-toolbar-label">Filtros de almacenes</span>
          <button
            type="button"
            className="entity-filter-clear"
            onClick={clearAirportFilters}
            disabled={!airportFilters.codeQuery && !airportFilters.continentQuery}
            title="Limpiar filtros"
          >
            <span>Limpiar</span>
          </button>
        </div>
        <div className="entity-filter-grid entity-filter-grid-airports">
          <label className="field">
            <span className="entity-filter-label">Código</span>
            <input
              type="text"
              placeholder={labels?.airportPlaceholder ?? 'Ej. LIM'}
              value={airportFilters.codeQuery}
              onChange={(event) => handleAirportFilterChange('codeQuery', event.target.value)}
              onKeyDown={handleAirportKeyDown}
            />
          </label>
          <label className="field">
            <span className="entity-filter-label">Región continental</span>
            <select
              value={selectedAirportContinentValue}
              onChange={(event) =>
                handleAirportFilterChange('continentQuery', event.target.value)
              }
            >
              <option value="">Todas</option>
              {airportContinentOptions.map((continent) => (
                <option key={continent} value={continent}>
                  {continent}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="entity-toolbar">
        <label className="field entity-sort-field">
          <span className="entity-toolbar-label">Ordenar por</span>
          <div className="entity-sort-row">
            <select
              value={airportSortKey}
              onChange={(event) => handleAirportSortChange(event.target.value as AirportSortKey)}
            >
              <option value="occupancy">Nivel de ocupación</option>
              <option value="departure">Próxima salida</option>
              <option value="arrival">Próxima llegada</option>
            </select>
            <button
              type="button"
              className="entity-sort-direction"
              onClick={handleAirportSortDirectionToggle}
              title={
                airportSortDirection === 'asc'
                  ? 'Cambiar a descendente'
                  : 'Cambiar a ascendente'
              }
            >
              {airportSortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </label>
      </div>
      <div
        ref={airportListRef}
        className="flight-list"
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
              const occupancyLabel = hasOccupancy
                ? `${formatInteger(airport.ocupacion)} / ${formatInteger(airport.capacidad)}`
                : airport.capacidad !== undefined
                  ? `Cap. ${formatInteger(airport.capacidad)}`
                  : 'Capacidad n/d'

              return (
                <button
                  key={airport.codigoOaci}
                  className={`flight-item entity-airport-item ${selectedAirportCode === airport.codigoOaci ? "active" : ""}`}
                  onClick={() => onSelectAirport(airport.codigoOaci)}
                  style={{ height: `${AIRPORT_ITEM_HEIGHT}px` }}
                >
                  <div>
                    <div className="flight-label">{`${airport.codigoOaci} | ${airport.nombre}`}</div>
                    <div className="flight-meta">{`${airport.pais} · ${occupancyLabel}`}</div>
                    <div className="flight-meta" style={{ marginTop: '2px' }}>
                      Próx. Salida: {formatSimMinute(airport.nextDepartureMin, true)}
                    </div>
                    <div className="flight-meta">
                      Próx. Llegada: {formatSimMinute(airport.nextArrivalMin, true)}
                    </div>
                  </div>
                  {airport.porcentaje !== undefined ? (
                    <div className="entity-airport-status">
                      <span>{formatPercent(airport.porcentaje, 0)}</span>
                      <span
                        className="warehouse-dot"
                        style={{ background: airport.color }}
                      />
                    </div>
                  ) : null}
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
          className={`entity-subtab ${activeEntityTab === "shipments" ? "active" : ""} ${filteredShipments.length === 0 ? "empty" : ""}`}
          onClick={() => setActiveEntityTab("shipments")}
        >
          {`Envíos (${formatInteger(filteredShipments.length)})`}
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
