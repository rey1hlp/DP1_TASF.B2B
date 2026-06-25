import { useMemo, useState, type KeyboardEvent } from 'react'
import useVirtualList from '../hooks/useVirtualList'
import {
  formatDurationHours,
  formatInteger,
  formatMinuteRange,
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
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  currentMinute: number | null
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

const ITEM_HEIGHT = 44
const AIRPORT_ITEM_HEIGHT = 56
const AIRPORT_PREVIEW_LIMIT = 30

function getDynamicShipmentStatus(route: EntityShipmentRoute, currentMinute: number | null) {
  if (!route || route.ruta.length === 0) return route?.estado || 'DESCONOCIDO'
  if (currentMinute === null) return route.estado === 'CON_RETRASO' ? 'ENTREGADO (CON RETRASO)' : route.estado

  const first = route.ruta[0]
  const last = route.ruta[route.ruta.length - 1]

  if (currentMinute < first.salidaMin) {
    return 'EN ALMACÉN (Origen)'
  }
  if (currentMinute > last.llegadaMin) {
    return route.estado === 'CON_RETRASO' ? 'ENTREGADO (CON RETRASO)' : 'ENTREGADO'
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
  onSearchShipment,
  shipmentSearchError,
  currentMinute,
  labels,
  listHeight = 320,
  shipmentListHeight = 220,
}: EntityExplorerProps) {
  const [activeEntityTab, setActiveEntityTab] = useState<EntityTab>("flights");
  const [flightQuery, setFlightQuery] = useState("");
  const [airportQuery, setAirportQuery] = useState("");
  const [shipmentQuery, setShipmentQuery] = useState("");

  const filteredFlights = useMemo(() => {
    const query = flightQuery.trim().toLowerCase();
    if (!query) return flights;
    return flights.filter((flight) => {
      const label =
        `${flight.flightId} ${flight.origen} ${flight.destino} ${flight.estado ?? ""}`.toLowerCase();
      return label.includes(query);
    });
  }, [flights, flightQuery]);

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

  const filteredShipments = useMemo(() => {
    const query = shipmentQuery.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((shipment) =>
      shipment.toLowerCase().includes(query),
    );
  }, [shipments, shipmentQuery]);

  const flightList = useVirtualList(filteredFlights, {
    itemHeight: ITEM_HEIGHT,
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
    const target = filteredFlights[0];
    if (target) onSelectFlight(target.flightId);
  };

  const handleAirportKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const target = displayedAirports[0];
    if (target) onSelectAirport(target.codigoOaci);
  };

  const renderFlights = () => (
    <>
      <h3>{labels?.flightTitle ?? "Buscar vuelo en la simulación"}</h3>
      <label className="field">
        <input
          type="text"
          placeholder={
            labels?.flightPlaceholder ?? "Buscar por ID, origen o destino"
          }
          value={flightQuery}
          onChange={(event) => setFlightQuery(event.target.value)}
          onKeyDown={handleFlightKeyDown}
        />
      </label>
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
            {flightList.visibleItems.map((flight) => (
              <button
                key={flight.flightId}
                className={`flight-item ${selectedFlightId === flight.flightId ? "active" : ""}`}
                onClick={() => onSelectFlight(flight.flightId)}
                style={{ height: `${ITEM_HEIGHT}px` }}
              >
                <div className="flight-label">{`${flight.flightId} | ${flight.origen} → ${flight.destino}`}</div>
                <div className="flight-meta">
                  {`${flight.estado ? `${flight.estado} · ` : ""}Salida ${formatMinuteRange(flight.salidaMin, flight.llegadaMin)}`}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flight-hint">
        {labels?.flightHint ??
          `${formatInteger(filteredFlights.length)} ${labels?.flightHintNoun ?? "vuelos"}`}
      </div>
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
                Salida {formatMinuteRange(step.salidaMin, step.llegadaMin)}
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
