import { useMemo, useState, type KeyboardEvent } from 'react'

export type SimulationControlsProps = {
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
}

export default function SimulationControls({
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
}: SimulationControlsProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'flights'>('config')
  const [inicio, setInicio] = useState('2026-02-15')
  const [dias, setDias] = useState(3)
  const [flightQuery, setFlightQuery] = useState('')
  const [flightScrollTop, setFlightScrollTop] = useState(0)

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

  const listHeight = 280
  const itemHeight = 44
  const visibleCount = Math.ceil(listHeight / itemHeight) + 6
  const startIndex = Math.max(0, Math.floor(flightScrollTop / itemHeight))
  const endIndex = Math.min(filteredFlights.length, startIndex + visibleCount)
  const visibleFlights = filteredFlights.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  const handleFlightKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }
    const target = filteredFlights[0]
    if (target) {
      onSelectFlight(target.flightId)
    }
  }

  return (
    <div className="control-panel">
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Configuracion
        </button>
        <button
          className={`panel-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Estadisticas
        </button>
        <button
          className={`panel-tab ${activeTab === 'flights' ? 'active' : ''}`}
          onClick={() => setActiveTab('flights')}
        >
          Vuelos
        </button>
      </div>

      {activeTab === 'config' ? (
        <>
          <h3>Configuracion de simulacion</h3>
          <div className="chip-row">
            <button
              className={`chip ${dias === 3 ? 'active' : ''}`}
              onClick={() => setDias(3)}
            >
              3 dias
            </button>
            <button
              className={`chip ${dias === 5 ? 'active' : ''}`}
              onClick={() => setDias(5)}
            >
              5 dias
            </button>
            <button
              className={`chip ${dias === 7 ? 'active' : ''}`}
              onClick={() => setDias(7)}
            >
              7 dias
            </button>
          </div>

          <label className="field">
            Fecha de inicio
            <input
              type="date"
              value={inicio}
              onChange={(event) => setInicio(event.target.value)}
            />
          </label>

          <div className="field">
            <div className="field-label">Rangos de semaforo</div>
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
              <span className="range-value">{`${greenMax}% - ${amberMax}%`}</span>
            </div>
            <div className="range-row">
              <span className="range-label">Rojo</span>
              <div className="range-static">{`${amberMax}% - 100%`}</div>
            </div>
          </div>

          <div className="buttons">
            <button
              className="btn primary"
              onClick={() => onStart({ inicio, dias })}
              disabled={isRunning}
            >
              {isRunning ? 'Ejecutando...' : 'Iniciar'}
            </button>
            <button
              className="btn"
              onClick={isPaused ? onResume : onPause}
              disabled={!isRunning}
            >
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
          <h3>Estadisticas de la simulacion</h3>
          <div className="metric-grid">
            {stats.cards.map((card) => (
              <div className="metric" key={card.label}>
                <div className="metric-value">{card.value}</div>
                <div className="metric-label">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="progress-block">
            <div className="progress-title">Progreso de simulacion</div>
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
            <h4>Ocupacion de almacenes</h4>
            <div className="warehouse-list">
              {warehouseItems.map((item) => (
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
              ))}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'flights' ? (
        <>
          <h3>Buscar vuelo en la simulacion</h3>
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
            <div className="flight-list-spacer" style={{ height: `${filteredFlights.length * itemHeight}px` }}>
              <div className="flight-list-items" style={{ transform: `translateY(${offsetY}px)` }}>
                {visibleFlights.map((flight) => (
                  <button
                    key={flight.flightId}
                    className={`flight-item ${selectedFlightId === flight.flightId ? 'active' : ''}`}
                    onClick={() => onSelectFlight(flight.flightId)}
                    style={{ height: `${itemHeight}px` }}
                  >
                    <div className="flight-label">{`${flight.flightId} | ${flight.origen} → ${flight.destino}`}</div>
                    <div className="flight-meta">{`Salida ${flight.salidaMin} - Llegada ${flight.llegadaMin}`}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flight-hint">{`${filteredFlights.length} vuelos activos`}</div>
        </>
      ) : null}
    </div>
  )
}
