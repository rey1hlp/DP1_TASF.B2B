// src/components/DailyOperationControls.tsx

import { useMemo, useState, type KeyboardEvent } from 'react'

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

export type DailyOperationControlsProps = {
  onRefresh: () => void
  loading: boolean
  socketConnected: boolean
  lastSyncLabel: string

  ranges: { greenMax: number; amberMax: number }
  onRangesChange: (ranges: { greenMax: number; amberMax: number }) => void

  stats: {
    cards: Array<{ label: string; value: string }>
    bars: Array<{ label: string; value: number }>
  }

  shipmentSummary: {
    total: number
    pending: number
    assigned: number
    inTransit: number
    delivered: number
  } | null

  warehouseItems: Array<{
    codigoOaci: string
    nombre: string
    pais: string
    porcentaje: number
    color: string
  }>

  flightItems: Array<{
    flightId: number
    origen: string
    destino: string
    salidaMin: number
    llegadaMin: number
    estado?: string
  }>

  upcomingFlightItems: Array<{
    flightId: number
    origen: string
    destino: string
    salidaMin: number
    llegadaMin: number
    estado?: string
  }>

  selectedFlightId: number | null
  onSelectFlight: (flightId: number) => void

  airportItems: Array<{
    codigoOaci: string
    nombre: string
    pais: string
  }>

  selectedAirportCode: string | null
  onSelectAirport: (codigoOaci: string) => void

  alerts: Array<{
    id: string
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
    message: string
    createdAt: string
  }>

  isCollapsed: boolean
  onToggleCollapse: () => void

  selectedShipmentRoute: RespuestaRutaEnvioDto | null
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  sampleShipments: string[]
  currentMinute: number | null
}

export default function DailyOperationControls({
  onRefresh,
  loading,
  socketConnected,
  lastSyncLabel,
  ranges,
  onRangesChange,
  stats,
  shipmentSummary,
  warehouseItems,
  flightItems,
  upcomingFlightItems,
  selectedFlightId,
  onSelectFlight,
  airportItems,
  selectedAirportCode,
  onSelectAirport,
  alerts,
  isCollapsed,
  onToggleCollapse,
  selectedShipmentRoute,
  onSearchShipment,
  shipmentSearchError,
  sampleShipments,
  currentMinute,
}: DailyOperationControlsProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'entities'>('stats')
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

  const allFlights = useMemo(() => {
    const map = new Map<number, DailyOperationControlsProps['flightItems'][number]>()

    flightItems.forEach((flight) => {
      map.set(flight.flightId, flight)
    })

    upcomingFlightItems.forEach((flight) => {
      map.set(flight.flightId, flight)
    })

    return Array.from(map.values())
  }, [flightItems, upcomingFlightItems])

  const filteredFlights = useMemo(() => {
    const query = flightQuery.trim().toLowerCase()

    if (!query) {
      return allFlights
    }

    return allFlights.filter((flight) => {
      const label = `${flight.flightId} ${flight.origen} ${flight.destino} ${flight.estado ?? ''}`.toLowerCase()
      return label.includes(query)
    })
  }, [allFlights, flightQuery])

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

  const listHeight = 280
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
  
  const shipmentStartIndex = Math.max(0, Math.floor(shipmentScrollTop / itemHeight))
  const shipmentEndIndex = Math.min(filteredShipments.length, shipmentStartIndex + visibleCount)
  const visibleShipments = filteredShipments.slice(shipmentStartIndex, shipmentEndIndex)
  const shipmentOffsetY = shipmentStartIndex * itemHeight

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

  const handleFlightKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }

    const target = filteredFlights[0]

    if (target) {
      onSelectFlight(target.flightId)
    }
  }

  const handleAirportKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }

    const target = filteredAirports[0]

    if (target) {
      onSelectAirport(target.codigoOaci)
    }
  }

  return (
    <div className={`control-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="toggle-panel-btn" 
        onClick={onToggleCollapse}
        title={isCollapsed ? "Expandir panel" : "Colapsar panel"}
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
          Operación
        </button>

        <button
          className={`panel-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Indicadores
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
          <h3>Control operacional</h3>

          <div className="metric-grid">
            <div className="metric">
              <div className="metric-value">{socketConnected ? 'En vivo' : 'Sin  conexión'}</div>
              <div className="metric-label">Conexión</div>
            </div>

            <div className="metric">
              <div className="metric-value">{loading ? 'Cargando' : 'Listo'}</div>
              <div className="metric-label">Estado</div>
            </div>
          </div>

          <div className="field">
            <div className="field-label">Última actualización</div>
            <div className="range-static">{lastSyncLabel}</div>
          </div>

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
              <span className="range-label">Ámbar</span>
              <input
                type="range"
                min={0}
                max={100}
                value={amberMax}
                onChange={(event) => handleAmberChange(Number(event.target.value))}
              />
              <span className="range-value">{`${greenMax}% - ${amberMax}%`}</span>
            </div>

            <div className="range-row">
              <span className="range-label">Rojo</span>
              <div className="range-static">{`${amberMax}% - 100%`}</div>
            </div>
          </div>

          <div className="buttons">
            <button className="btn primary" onClick={onRefresh} disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar datos'}
            </button>

            <button className="btn ghost" disabled>
              Exportar CSV
            </button>
          </div>

          <div className="warehouse">
            <h4>Alertas operativas</h4>

            <div className="warehouse-list">
              {alerts.length === 0 ? (
                <div className="flight-hint">No hay alertas operativas.</div>
              ) : (
                alerts.slice(0, 5).map((alert) => (
                  <div className="warehouse-item" key={alert.id}>
                    <div>
                      <div className="warehouse-title">{alert.severity}</div>
                      <div className="warehouse-sub">{alert.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'stats' ? (
        <>
          <h3>Indicadores de operación diaria</h3>

          <div className="metric-grid">
            {stats.cards.map((card) => (
              <div className="metric" key={card.label}>
                <div className="metric-value">{card.value}</div>
                <div className="metric-label">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="progress-block">
            <div className="progress-title">Estado operacional</div>

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
            <h4>Resumen de envíos</h4>

            <div className="metric-grid">
              <div className="metric">
                <div className="metric-value">{shipmentSummary?.total ?? '--'}</div>
                <div className="metric-label">Totales</div>
              </div>

              <div className="metric">
                <div className="metric-value">{shipmentSummary?.assigned ?? '--'}</div>
                <div className="metric-label">Asignados</div>
              </div>

              <div className="metric">
                <div className="metric-value">{shipmentSummary?.inTransit ?? '--'}</div>
                <div className="metric-label">En ruta</div>
              </div>

              <div className="metric">
                <div className="metric-value">{shipmentSummary?.pending ?? '--'}</div>
                <div className="metric-label">Pendientes</div>
              </div>

              <div className="metric">
                <div className="metric-value">{shipmentSummary?.delivered ?? '--'}</div>
                <div className="metric-label">Entregados</div>
              </div>
            </div>
          </div>

          <div className="warehouse">
            <h4>Ocupación de almacenes</h4>

            <div className="warehouse-list">
              {warehouseItems.length === 0 ? (
                <div className="flight-hint">No hay ocupación disponible.</div>
              ) : (
                warehouseItems.map((item) => (
                  <div className="warehouse-item" key={item.codigoOaci}>
                    <div>
                      <div className="warehouse-title">{`${item.codigoOaci} - ${item.nombre}`}</div>
                      <div className="warehouse-sub">{item.pais}</div>
                    </div>

                    <div className="warehouse-right">
                      <span>{`${item.porcentaje.toFixed(0)}%`}</span>
                      <span className="warehouse-dot" style={{ background: item.color }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'entities' ? (
        <>
          <h3>Buscar vuelo operativo</h3>

          <label className="field">
            <input
              type="text"
              placeholder="Buscar por ID, origen, destino o estado"
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
              <div
                className="flight-list-items"
                style={{ transform: `translateY(${offsetY}px)` }}
              >
                {visibleFlights.map((flight) => (
                  <button
                    key={flight.flightId}
                    className={`flight-item ${
                      selectedFlightId === flight.flightId ? 'active' : ''
                    }`}
                    onClick={() => onSelectFlight(flight.flightId)}
                    style={{ height: `${itemHeight}px` }}
                  >
                    <div className="flight-label">
                      {`${flight.flightId} | ${flight.origen} → ${flight.destino}`}
                    </div>
                    <div className="flight-meta">
                      {`${flight.estado ?? 'Planificado'} · Salida ${flight.salidaMin} - Llegada ${flight.llegadaMin}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flight-hint">{`${filteredFlights.length} vuelos encontrados`}</div>

          <h3>Buscar envío / maleta</h3>
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
            style={{ height: `150px`, marginTop: '8px' }}
          >
            <div className="flight-list-spacer" style={{ height: `${filteredShipments.length * itemHeight}px` }}>
              <div className="flight-list-items" style={{ transform: `translateY(${shipmentOffsetY}px)` }}>
                {visibleShipments.length === 0 && <div style={{padding: '10px', fontSize: '12px'}}>No hay muestras (inicia operación)</div>}
                {visibleShipments.map((codigo) => (
                  <button
                    key={codigo}
                    className={`flight-item ${selectedShipmentRoute?.codigoPedido === codigo ? 'active' : ''}`}
                    onClick={() => onSearchShipment(codigo)}
                    style={{ height: `${itemHeight}px` }}
                  >
                    <div className="flight-label">{`📢 Pedido: ${codigo}`}</div>
                    <div className="flight-meta">Click para ver ruta</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flight-hint">{`${filteredShipments.length} envíos de muestra`}</div>

          <div className="buttons" style={{ marginTop: '4px', marginBottom: '4px' }}>
            <button className="btn" onClick={() => onSearchShipment(shipmentQuery)}>Buscar ruta</button>
          </div>
          {shipmentSearchError && <div className="upload-error" style={{ marginBottom: '8px' }}>{shipmentSearchError}</div>}
          {selectedShipmentRoute && (
            <div className="flight-list" style={{ maxHeight: '200px', height: 'auto', marginBottom: '10px' }}>
              <div style={{ padding: '10px', fontSize: '12px', background: '#eaf0fb', borderBottom: '1px solid #d9e4f4' }}>
                <strong>Estado:</strong> {getDynamicShipmentStatus(selectedShipmentRoute)} <br />
                <strong>Tiempo total:</strong> {selectedShipmentRoute.tiempoTotalHoras.toFixed(1)} h
              </div>
              {selectedShipmentRoute.ruta.length === 0 && (
                <div style={{ padding: '10px', fontSize: '12px' }}>No hay saltos registrados.</div>
              )}
              {selectedShipmentRoute.ruta.map((paso, idx) => (
                <div key={idx} className="flight-item" style={{ borderBottom: '1px solid rgba(217, 228, 244, 0.8)', cursor: 'default' }}>
                  <div className="flight-label">{paso.vueloId} | {paso.origen} → {paso.destino}</div>
                  <div className="flight-meta">Salida {paso.salidaMin} - Llegada {paso.llegadaMin}</div>
                </div>
              ))}
            </div>
          )}
          <h3>Buscar aeropuerto operativo</h3>

          <label className="field">
            <input
              type="text"
              placeholder="Buscar por OACI, nombre o país"
              value={airportQuery}
              onChange={(event) => setAirportQuery(event.target.value)}
              onKeyDown={handleAirportKeyDown}
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
              <div
                className="flight-list-items"
                style={{ transform: `translateY(${airportOffsetY}px)` }}
              >
                {visibleAirports.map((airport) => (
                  <button
                    key={airport.codigoOaci}
                    className={`flight-item ${
                      selectedAirportCode === airport.codigoOaci ? 'active' : ''
                    }`}
                    onClick={() => onSelectAirport(airport.codigoOaci)}
                    style={{ height: `${itemHeight}px` }}
                  >
                    <div className="flight-label">
                      {`${airport.codigoOaci} | ${airport.nombre}`}
                    </div>
                    <div className="flight-meta">{airport.pais}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flight-hint">{`${filteredAirports.length} aeropuertos`}</div>
        </>
      ) : null}
        </div>
      )}
    </div>
  )
}
