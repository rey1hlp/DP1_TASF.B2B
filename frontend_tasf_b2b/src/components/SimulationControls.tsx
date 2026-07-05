import { useEffect, useState } from 'react'
import EntityExplorer, { type EntityAirportItem, type EntityFlightItem } from './EntityExplorer'
import MapFiltersPanel from './MapFiltersPanel'
import SemaphoreRangeControl from './ui/SemaphoreRangeControl'
import type { FlightTextFilters, MapSemaphoreFilters } from '../types/mapFilters'
import type { EntityFocusRequest } from '../types/entityFocus'

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
  mapFilters: MapSemaphoreFilters
  onMapFiltersChange: (filters: MapSemaphoreFilters) => void
  mapFilterCounts: { flights: number; warehouses: number }
  stats: {
    cards: Array<{ label: string; value: string }>
    bars: Array<{ label: string; value: number }>
  }
  flightItems: EntityFlightItem[]
  selectedFlightId: number | null
  onSelectFlight: (flightId: number) => void
  airportItems: EntityAirportItem[]
  selectedAirportCode: string | null
  onSelectAirport: (codigoOaci: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  selectedShipmentRoute: RespuestaRutaEnvioDto | null
  onSearchShipment: (codigo: string) => void
  shipmentSearchError: string | null
  sampleShipments: string[]
  flightTextFilters: FlightTextFilters
  onFlightTextFiltersChange: (filters: FlightTextFilters) => void
  currentMinute: number | null
  entityFocusRequest?: EntityFocusRequest | null
}

export default function SimulationControls({
  mode,
  onStart,
  onPause,
  onResume,
  isRunning,
  isPaused,
  ranges,
  onRangesChange,
  mapFilters,
  onMapFiltersChange,
  mapFilterCounts,
  stats,
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
  flightTextFilters,
  onFlightTextFiltersChange,
  currentMinute,
  entityFocusRequest,
}: SimulationControlsProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'entities'>('config')
  const [inicio, setInicio] = useState('2026-02-15T00:00')
  const [dias, setDias] = useState(3)

  useEffect(() => {
    if (entityFocusRequest) {
      setActiveTab('entities')
    }
  }, [entityFocusRequest])

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
                    3 dias
                  </button>
                  <button className={`chip ${dias === 5 ? 'active' : ''}`} onClick={() => setDias(5)}>
                    5 dias
                  </button>
                  <button className={`chip ${dias === 7 ? 'active' : ''}`} onClick={() => setDias(7)}>
                    7 dias
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#4b5f7a' }}>
                  La simulación hasta el colapso se ejecuta desde la fecha seleccionada y sigue
                  hasta que no haya mas capacidad o datos disponibles.
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

              <SemaphoreRangeControl ranges={ranges} onChange={onRangesChange} />
              <MapFiltersPanel
                filters={mapFilters}
                onChange={onMapFiltersChange}
                visibleCounts={mapFilterCounts}
              />

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
            </>
          ) : null}

          {activeTab === 'entities' ? (
            <EntityExplorer
              flights={flightItems}
              airports={airportItems}
              shipments={sampleShipments}
              selectedFlightId={selectedFlightId}
              selectedAirportCode={selectedAirportCode}
              selectedShipmentRoute={selectedShipmentRoute}
              onSelectFlight={onSelectFlight}
              onSelectAirport={onSelectAirport}
              flightFilters={flightTextFilters}
              onFlightFiltersChange={onFlightTextFiltersChange}
              onSearchShipment={onSearchShipment}
              shipmentSearchError={shipmentSearchError}
              currentMinute={currentMinute}
              focusRequest={entityFocusRequest}
              labels={{
                flightHintNoun: 'vuelos activos',
                shipmentEmpty: 'No hay muestras (inicia simulación)',
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
