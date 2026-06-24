import { useMemo, useState, type KeyboardEvent } from 'react'
import {
  formatDurationHours,
  formatInteger,
  formatMinuteRange,
  formatPercent,
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

export type SimulationControlsProps = {
  mode: 'period' | 'collapse'
  onStart: (payload: { inicio: string; dias: number }) => void
  onPause: () => void
  onResume: () => void
  isRunning: boolean
  isPaused: boolean
  ranges: { greenMax: number; amberMax: number }
  onRangesChange: (ranges: { greenMax: number; amberMax: number }) => void
  stats: {
    cards: Array<{ label: string; value: string }>
    bars: Array<{ label: string; value: number }>
  }
  warehouseItems: Array<{ codigoOaci: string; nombre: string; pais: string; porcentaje: number; color: string }>
  flightItems: Array<{
    flightId: number
    origen: string
    destino: string
    salidaMin: number
    llegadaMin: number
  }>
  selectedFlightId: number | null
  onSelectFlight: (flightId: number) => void
  airportItems: Array<{ codigoOaci: string; nombre: string; pais: string }>
  selectedAirportCode: string | null
  onSelectAirport: (codigoOaci: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  selectedShipmentRoute: RespuestaRutaEnvioDto | null
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  sampleShipments: string[]
  currentMinute: number | null
}

type EntityTab = 'flights' | 'shipments' | 'airports'

export default function SimulationControls({
  mode,
  onStart,
  onPause,
  onResume,
  isRunning,
  isPaused,
  ranges,
  onRangesChange,
  stats,
  warehouseItems,
  flightItems,
  selectedFlightId,
  onSelectFlight,
  airportItems,
  selectedAirportCode,
  onSelectAirport,
  isCollapsed,
  onToggleCollapse,
  selectedShipmentRoute,
  onSearchShipment,
  shipmentSearchError,
  sampleShipments,
  currentMinute,
}: SimulationControlsProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'entities'>('config')
  const [activeEntityTab, setActiveEntityTab] = useState<EntityTab>('flights')
  const [inicio, setInicio] = useState('2026-02-15T00:00')
  const [dias, setDias] = useState(3)
  const [flightQuery, setFlightQuery] = useState('')
  const [flightScrollTop, setFlightScrollTop] = useState(0)
  const [airportQuery, setAirportQuery] = useState('')
  const [airportScrollTop, setAirportScrollTop] = useState(0)
  const [shipmentQuery, setShipmentQuery] = useState('')
  const [shipmentScrollTop, setShipmentScrollTop] = useState(0)

  const greenMax = ranges.greenMax
  const amberMax = ranges.amberMax

  const handleGreenChange = (value: number) => {
    const next = Math.min(value, amberMax - 1)
    onRangesChange({ greenMax: Math.max(0, next), amberMax })
  }

  const handleAmberChange = (value: number) => {
    const next = Math.max(value, greenMax + 1)
    onRangesChange({ greenMax, amberMax: Math.min(100, next) })
  }

  const filteredFlights = useMemo(() => {
    const query = flightQuery.trim().toLowerCase()
    if (!query) {
      return flightItems
    }
    return flightItems.filter((flight) => {
      const label = `${flight.flightId} ${flight.origen} ${flight.destino}`.toLowerCase()
      return label.includes(query)
    })
  }, [flightItems, flightQuery])

  const filteredAirports = useMemo(() => {
    const query = airportQuery.trim().toLowerCase()
    if (!query) {
      return airportItems
    }
    return airportItems.filter((airport) => {
      const label = `${airport.codigoOaci} ${airport.nombre} ${airport.pais}`.toLowerCase()
      return label.includes(query)
    })
  }, [airportItems, airportQuery])

  const filteredShipments = useMemo(() => {
    const query = shipmentQuery.trim().toLowerCase()
    if (!query) return sampleShipments
    return sampleShipments.filter((s) => s.toLowerCase().includes(query))
  }, [sampleShipments, shipmentQuery])

  // Las sub-pestañas de entidades ahora tienen todo el alto disponible,
  // ya que ya no comparten el panel con las otras dos listas.
  const listHeight = 320
  const itemHeight = 44
  const visibleCount = Math.ceil(listHeight / itemHeight) + 6
  const startIndex = Math.max(0, Math.floor(flightScrollTop / itemHeight))
  const endIndex = Math.min(filteredFlights.length, startIndex + visibleCount)
  const visibleFlights = filteredFlights.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight
  const airportStartIndex = Math.max(0, Math.floor(airportScrollTop / itemHeight))
  const airportEndIndex = Math.min(filteredAirports.length, airportStartIndex + visibleCount)
  const visibleAirports = filteredAirports.slice(airportStartIndex, airportEndIndex)
  const airportOffsetY = airportStartIndex * itemHeight

  const shipmentListHeight = 220
  const shipmentVisibleCount = Math.ceil(shipmentListHeight / itemHeight) + 6
  const shipmentStartIndex = Math.max(0, Math.floor(shipmentScrollTop / itemHeight))
  const shipmentEndIndex = Math.min(filteredShipments.length, shipmentStartIndex + shipmentVisibleCount)
  const visibleShipments = filteredShipments.slice(shipmentStartIndex, shipmentEndIndex)
  const shipmentOffsetY = shipmentStartIndex * itemHeight

  const handleFlightKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }
    const target = filteredFlights[0]
    if (target) {
      onSelectFlight(target.flightId)
    }
  }

  const getDynamicShipmentStatus = (route: RespuestaRutaEnvioDto) => {
    if (!route || route.ruta.length === 0) return route?.estado || 'DESCONOCIDO'
    if (currentMinute === null) return route.estado === 'CON_RETRASO' ? 'ENTREGADO (CON RETRASO)' : route.estado

    const first = route.ruta[0]
    const last = route.ruta[route.ruta.length - 1]

    if (currentMinute < first.salidaMin) {
      return 'EN ALMACÉN (Origen)'
    } else if (currentMinute > last.llegadaMin) {
      return route.estado === 'CON_RETRASO' ? 'ENTREGADO (CON RETRASO)' : 'ENTREGADO'
    } else {
      for (const paso of route.ruta) {
        if (currentMinute >= paso.salidaMin && currentMinute <= paso.llegadaMin) {
          return `EN VUELO (${paso.origen} → ${paso.destino})`
        }
      }
      return 'EN ESCALA (Almacén)'
    }
  }

  return (
    <div className={`control-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="toggle-panel-btn"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expandir panel' : 'Colapsar panel'}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>

      {!isCollapsed && (
        <div className="control-panel-content">
          <div className="panel-tabs">
            <button
              className={`panel-tab ${activeTab === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab('config')}
            >
              Configuración
            </button>
            <button
              className={`panel-tab ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Estadísticas
            </button>
            <button
              className={`panel-tab ${activeTab === 'entities' ? 'active' : ''}`}
              onClick={() => setActiveTab('entities')}
            >
              Entidades
            </button>
          </div>

          {activeTab === 'config' ? (
            <>
              <h3>Configuración de simulación</h3>
              {mode === 'period' ? (
                <div className="chip-row">
                  <button className={`chip ${dias === 3 ? 'active' : ''}`} onClick={() => setDias(3)}>
                    3 días
                  </button>
                  <button className={`chip ${dias === 5 ? 'active' : ''}`} onClick={() => setDias(5)}>
                    5 días
                  </button>
                  <button className={`chip ${dias === 7 ? 'active' : ''}`} onClick={() => setDias(7)}>
                    7 días
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#4b5f7a' }}>
                  La simulación hasta el colapso se ejecuta desde la fecha seleccionada y sigue
                  hasta que no haya más capacidad o datos disponibles.
                </div>
              )}

              <label className="field">
                Fecha y hora de inicio
                <input
                  type="datetime-local"
                  value={inicio}
                  onChange={(event) => setInicio(event.target.value)}
                />
              </label>

              <div className="field">
                <div className="field-label">Rangos de semáforo</div>
                <div className="range-row">
                  <span className="range-label">Verde</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={greenMax}
                    onChange={(event) => handleGreenChange(Number(event.target.value))}
                  />
                  <span className="range-value">{`0% - ${greenMax}%`}</span>
                </div>
                <div className="range-row">
                  <span className="range-label">Ambar</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={amberMax}
                    onChange={(event) => handleAmberChange(Number(event.target.value))}
                  />
                  <span className="range-value">{`${greenMax + 1}% - ${amberMax}%`}</span>
                </div>
                <div className="range-row">
                  <span className="range-label">Rojo</span>
                  <div className="range-static">{`${amberMax + 1}% - 100%`}</div>
                </div>
              </div>

              <div className="buttons">
                <button className="btn primary" onClick={() => onStart({ inicio, dias })} disabled={isRunning}>
                  {isRunning ? 'Ejecutando...' : mode === 'collapse' ? 'Iniciar hasta el colapso' : 'Iniciar'}
                </button>
                <button className="btn" onClick={isPaused ? onResume : onPause} disabled={!isRunning}>
                  {isPaused ? 'Reanudar' : 'Pausar'}
                </button>
                <button className="btn ghost" disabled>
                  Exportar CSV
                </button>
              </div>
            </>
          ) : null}

          {activeTab === 'stats' ? (
            <>
              <h3>Estadísticas de la simulación</h3>
              <div className="metric-grid">
                {stats.cards.map((card) => (
                  <div className="metric" key={card.label}>
                    <div className="metric-value">{card.value}</div>
                    <div className="metric-label">{card.label}</div>
                  </div>
                ))}
              </div>

              <div className="progress-block">
                <div className="progress-title">Progreso de simulación</div>
                {stats.bars.map((bar) => (
                  <div className="progress-item" key={bar.label}>
                    <span>{bar.label}</span>
                    <div className="bar">
                      <div style={{ width: `${Math.min(100, Math.max(0, bar.value))}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="warehouse">
                <h4>Ocupación de almacenes</h4>
                <div className="warehouse-list">
                  {warehouseItems.map((item) => (
                    <div className="warehouse-item" key={item.codigoOaci}>
                      <div>
                        <div className="warehouse-title">{`${item.codigoOaci} - ${item.nombre}`}</div>
                        <div className="warehouse-sub">{item.pais}</div>
                      </div>
                      <div className="warehouse-right">
                        <span>{formatPercent(item.porcentaje, 0)}</span>
                        <span className="warehouse-dot" style={{ background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {activeTab === 'entities' ? (
            <>
              <div className="entity-subtabs">
                <button
                  className={`entity-subtab ${activeEntityTab === 'flights' ? 'active' : ''}`}
                  onClick={() => setActiveEntityTab('flights')}
                >
                  {`Vuelos (${formatInteger(filteredFlights.length)})`}
                </button>
                <button
                  className={`entity-subtab ${activeEntityTab === 'shipments' ? 'active' : ''}`}
                  onClick={() => setActiveEntityTab('shipments')}
                >
                  {`Envíos (${formatInteger(filteredShipments.length)})`}
                </button>
                <button
                  className={`entity-subtab ${activeEntityTab === 'airports' ? 'active' : ''}`}
                  onClick={() => setActiveEntityTab('airports')}
                >
                  {`Aeropuertos (${formatInteger(filteredAirports.length)})`}
                </button>
              </div>

              {activeEntityTab === 'flights' ? (
                <>
                  <h3>Buscar vuelo en la simulación</h3>
                  <label className="field">
                    <input
                      type="text"
                      placeholder="Buscar por ID, origen o destino"
                      value={flightQuery}
                      onChange={(event) => setFlightQuery(event.target.value)}
                      onKeyDown={handleFlightKeyDown}
                    />
                  </label>
                  <div
                    className="flight-list"
                    onScroll={(event) => setFlightScrollTop(event.currentTarget.scrollTop)}
                    style={{ height: `${listHeight}px` }}
                  >
                    <div
                      className="flight-list-spacer"
                      style={{ height: `${filteredFlights.length * itemHeight}px` }}
                    >
                      <div className="flight-list-items" style={{ transform: `translateY(${offsetY}px)` }}>
                        {visibleFlights.map((flight) => (
                          <button
                            key={flight.flightId}
                            className={`flight-item ${selectedFlightId === flight.flightId ? 'active' : ''}`}
                            onClick={() => onSelectFlight(flight.flightId)}
                            style={{ height: `${itemHeight}px` }}
                          >
                            <div className="flight-label">{`${flight.flightId} | ${flight.origen} → ${flight.destino}`}</div>
                            <div className="flight-meta">{`Salida ${formatMinuteRange(flight.salidaMin, flight.llegadaMin)}`}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flight-hint">{`${formatInteger(filteredFlights.length)} vuelos activos`}</div>
                </>
              ) : null}

              {activeEntityTab === 'shipments' ? (
                <>
                  <h3>Buscar envío o maleta</h3>
                  <label className="field">
                    <input
                      type="text"
                      placeholder="Ingresar ID del envío (ej. 000000001)"
                      value={shipmentQuery}
                      onChange={(event) => setShipmentQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') onSearchShipment(shipmentQuery)
                      }}
                    />
                  </label>

                  <div
                    className="flight-list"
                    onScroll={(event) => setShipmentScrollTop(event.currentTarget.scrollTop)}
                    style={{ height: `${shipmentListHeight}px`, marginTop: '8px' }}
                  >
                    <div
                      className="flight-list-spacer"
                      style={{ height: `${filteredShipments.length * itemHeight}px` }}
                    >
                      <div className="flight-list-items" style={{ transform: `translateY(${shipmentOffsetY}px)` }}>
                        {visibleShipments.length === 0 && (
                          <div style={{ padding: '10px', fontSize: '12px' }}>No hay muestras (inicia simulación)</div>
                        )}
                        {visibleShipments.map((codigo) => (
                          <button
                            key={codigo}
                            className={`flight-item ${selectedShipmentRoute?.codigoPedido === codigo ? 'active' : ''}`}
                            onClick={() => onSearchShipment(codigo)}
                            style={{ height: `${itemHeight}px` }}
                          >
                            <div className="flight-label">{`📦 Pedido: ${codigo}`}</div>
                            <div className="flight-meta">Click para ver ruta</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flight-hint">{`${formatInteger(filteredShipments.length)} envíos de muestra`}</div>

                  <div className="buttons" style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <button className="btn" onClick={() => onSearchShipment(shipmentQuery)}>
                      Buscar ruta
                    </button>
                  </div>
                  {shipmentSearchError && (
                    <div className="upload-error" style={{ marginBottom: '8px' }}>
                      {shipmentSearchError}
                    </div>
                  )}
                  {selectedShipmentRoute && (
                    <div className="flight-list" style={{ maxHeight: '220px', height: 'auto', marginBottom: '10px' }}>
                      <div
                        style={{
                          padding: '10px',
                          fontSize: '12px',
                          background: '#eaf0fb',
                          borderBottom: '1px solid #d9e4f4',
                        }}
                      >
                        <strong>Estado:</strong> {getDynamicShipmentStatus(selectedShipmentRoute)} <br />
                        <strong>Tiempo total:</strong> {formatDurationHours(selectedShipmentRoute.tiempoTotalHoras)}
                      </div>
                      {selectedShipmentRoute.ruta.length === 0 && (
                        <div style={{ padding: '10px', fontSize: '12px' }}>No hay saltos registrados.</div>
                      )}
                      {selectedShipmentRoute.ruta.map((paso, idx) => (
                        <div
                          key={idx}
                          className="flight-item"
                          style={{ borderBottom: '1px solid rgba(217, 228, 244, 0.8)', cursor: 'default' }}
                        >
                          <div className="flight-label">
                            {paso.vueloId} | {paso.origen} → {paso.destino}
                          </div>
                          <div className="flight-meta">
                            Salida {formatMinuteRange(paso.salidaMin, paso.llegadaMin)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {activeEntityTab === 'airports' ? (
                <>
                  <h3>Buscar aeropuerto en la simulación</h3>
                  <label className="field">
                    <input
                      type="text"
                      placeholder="Buscar por OACI, nombre o país"
                      value={airportQuery}
                      onChange={(event) => setAirportQuery(event.target.value)}
                    />
                  </label>
                  <div
                    className="flight-list"
                    onScroll={(event) => setAirportScrollTop(event.currentTarget.scrollTop)}
                    style={{ height: `${listHeight}px` }}
                  >
                    <div
                      className="flight-list-spacer"
                      style={{ height: `${filteredAirports.length * itemHeight}px` }}
                    >
                      <div className="flight-list-items" style={{ transform: `translateY(${airportOffsetY}px)` }}>
                        {visibleAirports.map((airport) => (
                          <button
                            key={airport.codigoOaci}
                            className={`flight-item ${selectedAirportCode === airport.codigoOaci ? 'active' : ''}`}
                            onClick={() => onSelectAirport(airport.codigoOaci)}
                            style={{ height: `${itemHeight}px` }}
                          >
                            <div className="flight-label">{`${airport.codigoOaci} | ${airport.nombre}`}</div>
                            <div className="flight-meta">{airport.pais}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flight-hint">{`${filteredAirports.length} aeropuertos`}</div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
