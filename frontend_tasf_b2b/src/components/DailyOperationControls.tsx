// src/components/DailyOperationControls.tsx

import { useEffect, useMemo, useState } from 'react'
import EntityExplorer, { type EntityAirportItem, type EntityFlightItem } from './EntityExplorer'
import MapFiltersPanel from './MapFiltersPanel'
import {
  formatInteger,
} from '../utils/time'
import SemaphoreRangeControl from './ui/SemaphoreRangeControl'
import type { FlightTextFilters, MapSemaphoreFilters } from '../types/mapFilters'
import type { EntityFocusRequest } from '../types/entityFocus'

export type PasoRutaDto = {
  vueloId: number | string
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
  mapFilters: MapSemaphoreFilters
  onMapFiltersChange: (filters: MapSemaphoreFilters) => void
  mapFilterCounts: { flights: number; warehouses: number }

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

  flightItems: EntityFlightItem[]

  upcomingFlightItems: EntityFlightItem[]

  selectedFlightId: number | null
  onSelectFlight: (flightId: number) => void

  airportItems: EntityAirportItem[]

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
  flightTextFilters: FlightTextFilters
  onFlightTextFiltersChange: (filters: FlightTextFilters) => void
  currentMinute: number | null
  entityFocusRequest?: EntityFocusRequest | null
}

export default function DailyOperationControls({
  onRefresh,
  loading,
  socketConnected,
  lastSyncLabel,
  ranges,
  onRangesChange,
  mapFilters,
  onMapFiltersChange,
  mapFilterCounts,
  stats,
  shipmentSummary,
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
  flightTextFilters,
  onFlightTextFiltersChange,
  currentMinute,
  entityFocusRequest,
}: DailyOperationControlsProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'stats' | 'entities'>('stats')

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

          <SemaphoreRangeControl ranges={ranges} onChange={onRangesChange} />
          <MapFiltersPanel
            filters={mapFilters}
            onChange={onMapFiltersChange}
            visibleCounts={mapFilterCounts}
          />

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
                <div className="metric-value">{formatInteger(shipmentSummary?.total)}</div>
                <div className="metric-label">Totales</div>
              </div>

              <div className="metric">
                <div className="metric-value">{formatInteger(shipmentSummary?.assigned)}</div>
                <div className="metric-label">Asignados</div>
              </div>

              <div className="metric">
                <div className="metric-value">{formatInteger(shipmentSummary?.inTransit)}</div>
                <div className="metric-label">En ruta</div>
              </div>

              <div className="metric">
                <div className="metric-value">{formatInteger(shipmentSummary?.pending)}</div>
                <div className="metric-label">Pendientes</div>
              </div>

              <div className="metric">
                <div className="metric-value">{formatInteger(shipmentSummary?.delivered)}</div>
                <div className="metric-label">Entregados</div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'entities' ? (
        <EntityExplorer
          flights={allFlights}
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
          listHeight={280}
          shipmentListHeight={150}
          labels={{
            airportTitle: 'Buscar aeropuerto operativo',
            flightHintNoun: 'vuelos encontrados',
            flightPlaceholder: 'Ej. 1024 o patron del vuelo',
            flightTitle: 'Buscar vuelo operativo',
            shipmentEmpty: 'No hay muestras (inicia operación)',
            shipmentIcon: '📢',
          }}
        />
      ) : null}
        </div>
      )}
    </div>
  )
}
