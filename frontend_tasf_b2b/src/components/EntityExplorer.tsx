import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import useVirtualList from '../hooks/useVirtualList'
import type { EntityFocusRequest } from '../types/entityFocus'
import type { FlightTextFilters } from '../types/mapFilters'
import type { ShipmentCrudDto } from '../types/sim'
// 1. Asegúrate de importar la función de simulación desde tu api
import { getShipmentsByFlight, getSimulationShipmentsByFlight } from '../services/api'

// 2. Importa el hook del contexto de simulación
import { useSimulationContext } from '../contexts/SimulationContext'

import {
  formatDurationHours,
  formatBags,
  formatInteger,
  formatMinuteRange,
  formatOperationalMinuteRange,
  formatPercent,
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
  capacidad?: number
  ocupacion?: number
  porcentaje?: number
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
  estado: string
  tiempoTotalHoras: number
  ruta: EntityRouteStep[]
}

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
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  currentMinute: number | null
  focusRequest?: EntityFocusRequest | null
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
}

type FlightSortKey =
  | 'default'
  | 'occupancy'
  | 'departure'
  | 'arrival'
  | 'origin'
  | 'destination'

type SortDirection = 'asc' | 'desc'

const ITEM_HEIGHT = 44
const FLIGHT_ITEM_HEIGHT = 56
const AIRPORT_ITEM_HEIGHT = 56
const AIRPORT_PREVIEW_LIMIT = 30

const FLIGHT_SORT_DEFAULT_DIRECTION: Record<FlightSortKey, SortDirection> = {
  default: 'asc',
  occupancy: 'desc',
  departure: 'asc',
  arrival: 'asc',
  origin: 'asc',
  destination: 'asc',
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
  onSearchShipment,
  shipmentSearchError,
  currentMinute,
  focusRequest,
  labels,
  listHeight = 320,
  shipmentListHeight = 220,
}: EntityExplorerProps) {
  void currentMinute
  void getDynamicShipmentStatus
  const [activeEntityTab, setActiveEntityTab] = useState<EntityTab>("flights");
  const [flightSortKey, setFlightSortKey] = useState<FlightSortKey>('default')
  const [flightSortDirection, setFlightSortDirection] = useState<SortDirection>('asc')
  const [airportQuery, setAirportQuery] = useState("");
  const [shipmentQuery, setShipmentQuery] = useState("");

  const { simulation } = useSimulationContext();
  const simId = simulation.simId;

  // --- NUEVO CÓDIGO: ESTADOS PARA MALETAS DEL VUELO ---
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

  const airportQueryText = airportQuery.trim().toLowerCase()

  const filteredAirports = useMemo(() => {
    const query = airportQuery.trim().toLowerCase();
    const matchesQuery = (airport: EntityAirportItem) => {
      const label =
        `${airport.codigoOaci} ${airport.nombre} ${airport.pais}`.toLowerCase()
      return label.includes(query);
    }
    const results = query ? airports.filter(matchesQuery) : airports

    return [...results].sort((a, b) => {
      const aPercent = a.porcentaje ?? -1
      const bPercent = b.porcentaje ?? -1
      if (aPercent !== bPercent) {
        return bPercent - aPercent
      }
      return a.codigoOaci.localeCompare(b.codigoOaci)
    })
  }, [airports, airportQuery]);

  const displayedAirports = useMemo(() => {
    if (airportQueryText) return filteredAirports
    return filteredAirports.slice(0, AIRPORT_PREVIEW_LIMIT)
  }, [airportQueryText, filteredAirports])

  const flightFilterAirportOptions = useMemo(() => {
    return [...airports].sort((left, right) => {
      const codeCompare = left.codigoOaci.localeCompare(right.codigoOaci)
      if (codeCompare !== 0) return codeCompare
      return left.nombre.localeCompare(right.nombre)
    })
  }, [airports])

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
    if (!focusRequest) return

    if (focusRequest.type === 'airport') {
      setActiveEntityTab('airports')
      setAirportQuery(String(focusRequest.id))
      airportList.setScrollTop(0)
      return
    }

    if (focusRequest.type === 'flight') {
      setActiveEntityTab('flights')
      flightList.setScrollTop(0)
      return
    }

    if (focusRequest.type === 'shipment') {
      setActiveEntityTab('shipments')
      setShipmentQuery(String(focusRequest.id))
      shipmentList.setScrollTop(0)
    }
  }, [focusRequest])

  const renderFlights = () => (
    <>
      <h3>{labels?.flightTitle ?? "Buscar vuelo en la simulación"}</h3>
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
            <RotateCcw size={15} />
            <span>Limpiar</span>
          </button>
        </div>
        <div className="entity-filter-grid">
          <label className="field">
            <span className="entity-filter-label">Codigo</span>
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
              <option value="occupancy">Nivel de ocupacion</option>
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
              {flightSortDirection === 'asc' ? '↑ Asc.' : '↓ Desc.'}
            </button>
          </div>
        </label>
      </div>
      <div
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
    </>
  );

  const renderShipments = () => (
    <>
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
            {shipmentList.visibleItems.map((codigo) => (
              <button
                key={codigo}
                className={`flight-item ${selectedShipmentRoute?.codigoPedido === codigo ? "active" : ""}`}
                onClick={() => onSearchShipment(codigo)}
                style={{ height: `${ITEM_HEIGHT}px` }}
              >
                <div className="flight-label">{`${labels?.shipmentIcon ?? "📦"} Pedido: ${codigo}`}</div>
                <div className="flight-meta">Click para ver ruta</div>
              </button>
            ))}
          </div>
        </div>
      </div>
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
            {getShipmentStatusLabel(selectedShipmentRoute.estado)}{" "}
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
      <h3>{labels?.airportTitle ?? "Buscar aeropuerto en la simulación"}</h3>
      <label className="field">
        <input
          type="text"
          placeholder={
            labels?.airportPlaceholder ?? "Buscar por OACI, nombre o país"
          }
          value={airportQuery}
          onChange={(event) => setAirportQuery(event.target.value)}
          onKeyDown={handleAirportKeyDown}
        />
      </label>
      <div
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
            airportQueryText
              ? `${formatInteger(filteredAirports.length)} ${labels?.airportHintNoun ?? "almacenes"}`
              : `Mostrando ${formatInteger(displayedAirports.length)} de ${formatInteger(filteredAirports.length)} ${labels?.airportHintNoun ?? "almacenes"}`
          )}
      </div>
    </>
  );

  return (
    <>
      <div className="entity-subtabs">
        <button
          className={`entity-subtab ${activeEntityTab === "flights" ? "active" : ""}`}
          onClick={() => setActiveEntityTab("flights")}
        >
          {`Vuelos (${formatInteger(filteredFlights.length)})`}
        </button>
        <button
          className={`entity-subtab ${activeEntityTab === "shipments" ? "active" : ""}`}
          onClick={() => setActiveEntityTab("shipments")}
        >
          {`Envíos (${formatInteger(filteredShipments.length)})`}
        </button>
        <button
          className={`entity-subtab ${activeEntityTab === "airports" ? "active" : ""}`}
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
