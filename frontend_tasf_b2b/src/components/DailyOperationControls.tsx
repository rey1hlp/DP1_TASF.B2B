// src/components/DailyOperationControls.tsx

import { useMemo, useState } from 'react'
import EntityExplorer from './EntityExplorer'
import {
  formatInteger,
  formatPercent,
} from '../utils/time'
import SemaphoreRangeControl from './ui/SemaphoreRangeControl'

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
                      <span>{formatPercent(item.porcentaje, 0)}</span>
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
        <EntityExplorer
          flights={allFlights}
          airports={airportItems}
          shipments={sampleShipments}
          selectedFlightId={selectedFlightId}
          selectedAirportCode={selectedAirportCode}
          selectedShipmentRoute={selectedShipmentRoute}
          onSelectFlight={onSelectFlight}
          onSelectAirport={onSelectAirport}
          onSearchShipment={onSearchShipment}
          shipmentSearchError={shipmentSearchError}
          currentMinute={currentMinute}
          listHeight={280}
          shipmentListHeight={150}
          labels={{
            airportTitle: 'Buscar aeropuerto operativo',
            flightHintNoun: 'vuelos encontrados',
            flightPlaceholder: 'Buscar por ID, origen, destino o estado',
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
