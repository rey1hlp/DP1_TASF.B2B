import { useEffect, useRef, useState } from 'react'
import {
  downloadSimulationReportCsv,
  downloadSimulationReportPdf,
  fetchSimulationReportImpacts,
  fetchSimulationReportRouteDetail,
  fetchSimulationReportRoutes,
  fetchSimulationReportSummary,
} from '../services/api'
import type {
  PageResponse,
  SimulationReportImpact,
  SimulationReportRoute,
  SimulationReportRouteDetail,
  SimulationReportSummary,
} from '../types/sim'
import {
  formatCompactDate,
  formatDateFromDayIndex,
  formatInteger,
  formatSimDateTimeFromMinute,
  getDayIndexFromDateString,
} from '../utils/time'
import './SimulationReportModal.css'

interface SimulationReportModalProps {
  isOpen: boolean
  simId?: string | null
  onClose: () => void
  mode: 'period' | 'collapse'
  meta: any
  statusMessage: string | null
  stats: any
}

function formatReportPeriodDate(value?: string | null): string {
  const dayIndex = getDayIndexFromDateString(value)
  if (dayIndex === null) {
    return formatCompactDate(value)
  }

  return formatDateFromDayIndex(dayIndex + 1)
}

function formatImpactType(value: string): string {
  if (value === 'REASSIGNED') return 'Reasignada'
  if (value === 'WITHOUT_ROUTE') return 'Sin ruta'
  if (value === 'CANCELLED_SEGMENT_REMOVED') return 'Tramo cancelado'
  return value
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function SimulationReportModal({
  isOpen,
  simId,
  onClose,
  mode,
  meta,
  statusMessage,
  stats
}: SimulationReportModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [summary, setSummary] = useState<SimulationReportSummary | null>(null)
  const [routes, setRoutes] = useState<PageResponse<SimulationReportRoute> | null>(null)
  const [impacts, setImpacts] = useState<PageResponse<SimulationReportImpact> | null>(null)
  const [routeDetail, setRouteDetail] = useState<SimulationReportRouteDetail | null>(null)
  const [routePage, setRoutePage] = useState(0)
  const [impactPage, setImpactPage] = useState(0)
  const [routeQuery, setRouteQuery] = useState('')
  const [routeEstado, setRouteEstado] = useState('')
  const [impactedOnly, setImpactedOnly] = useState(false)
  const [impactType, setImpactType] = useState('')
  const [loading, setLoading] = useState(false)
  const [routesLoading, setRoutesLoading] = useState(false)
  const [impactsLoading, setImpactsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const isCollapse = mode === 'collapse' && statusMessage && statusMessage.includes('Colapso')

  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !simId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSimulationReportSummary(simId)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null)
          setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, simId])

  useEffect(() => {
    if (!isOpen || !simId) return
    let cancelled = false
    setRoutesLoading(true)
    fetchSimulationReportRoutes(simId, {
      page: routePage,
      size: 10,
      query: routeQuery.trim(),
      estado: routeEstado,
      impactedOnly,
    })
      .then((data) => {
        if (!cancelled) setRoutes(data)
      })
      .catch(() => {
        if (!cancelled) setRoutes(null)
      })
      .finally(() => {
        if (!cancelled) setRoutesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [impactedOnly, isOpen, routeEstado, routePage, routeQuery, simId])

  useEffect(() => {
    if (!isOpen || !simId) return
    let cancelled = false
    setImpactsLoading(true)
    fetchSimulationReportImpacts(simId, {
      page: impactPage,
      size: 10,
      type: impactType,
    })
      .then((data) => {
        if (!cancelled) setImpacts(data)
      })
      .catch(() => {
        if (!cancelled) setImpacts(null)
      })
      .finally(() => {
        if (!cancelled) setImpactsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [impactPage, impactType, isOpen, simId])

  useEffect(() => {
    setRoutePage(0)
  }, [impactedOnly, routeEstado, routeQuery])

  useEffect(() => {
    setImpactPage(0)
  }, [impactType])

  if (!isOpen || !meta) return null

  const handleRouteDetail = async (codigoPedido: string) => {
    if (!simId) return
    try {
      setRouteDetail(await fetchSimulationReportRouteDetail(simId, codigoPedido))
    } catch {
      setRouteDetail(null)
    }
  }

  const handleExportCsv = async () => {
    if (!simId) return
    try {
      setExportError(null)
      const blob = await downloadSimulationReportCsv(simId, 'all')
      saveBlob(blob, `simulation-report-${simId}.csv`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar CSV')
    }
  }

  const handleExportPdf = async () => {
    if (!simId) return
    try {
      setExportError(null)
      const blob = await downloadSimulationReportPdf(simId)
      saveBlob(blob, `simulation-report-${simId}.pdf`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar PDF')
    }
  }

  const totalEnvios = summary?.totalEnvios ?? meta.totalEnvios
  const totalMaletas = summary?.totalMaletas ?? meta.totalMaletas
  const diasExtra = summary?.diasExtra ?? meta.diasExtra ?? 0
  const inicio = summary?.inicio ?? meta.inicio
  const fin = summary?.fin ?? meta.fin

  return (
    <div className="simulation-report-modal-overlay">
      <div
        className="simulation-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-report-title"
        aria-describedby="simulation-report-description"
      >
        <header className="simulation-report-modal-header">
          <div>
            <h2 id="simulation-report-title">
              {isCollapse ? 'Reporte de Colapso' : 'Resumen de Simulación'}
            </h2>
            <p id="simulation-report-description">
              {summary ? `Snapshot ${summary.versionNumber}` : 'Reporte de la simulación finalizada'}
            </p>
          </div>
          <button ref={closeButtonRef} className="close-button" onClick={onClose} aria-label="Cerrar">x</button>
        </header>

        <div className="simulation-report-modal-body">
          {isCollapse && (
            <div className="report-collapse-alert">
              <strong>Colapso detectado</strong>
              <p>{statusMessage}</p>
            </div>
          )}

          {loading && <div className="report-inline-state">Cargando reporte...</div>}
          {error && <div className="report-inline-error">{error}</div>}

          <div className="report-section">
            <h3>Datos generales</h3>
            <div className="report-grid">
              <div className="report-item">
                <span className="report-label">Periodo</span>
                <span className="report-value">
                  {formatReportPeriodDate(inicio)} - {formatReportPeriodDate(fin)}
                </span>
              </div>
              <div className="report-item">
                <span className="report-label">Total envíos</span>
                <span className="report-value">{formatInteger(totalEnvios)}</span>
              </div>
              <div className="report-item">
                <span className="report-label">Total maletas</span>
                <span className="report-value">{formatInteger(totalMaletas)}</span>
              </div>
              <div className="report-item">
                <span className="report-label">Días extra</span>
                <span className="report-value">{diasExtra}</span>
              </div>
              {summary && (
                <div className="report-item">
                  <span className="report-label">Rutas impactadas</span>
                  <span className="report-value">{formatInteger(summary.impactedRoutes)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <h3>Indicadores</h3>
            <div className="report-grid">
              {summary
                ? summary.metrics.map((metric) => (
                  <div className="report-item" key={metric.key}>
                    <span className="report-label">{metric.label}</span>
                    <span className="report-value">{metric.text ?? formatInteger(metric.value)}</span>
                  </div>
                ))
                : stats.cards.map((card: any, index: number) => (
                  <div className="report-item" key={index}>
                    <span className="report-label" style={{ color: card.labelColor }}>{card.label}</span>
                    <span className="report-value" style={card.color ? { backgroundColor: card.color, color: card.textColor, padding: '2px 6px', borderRadius: '4px' } : {}}>
                      {card.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="report-section">
            <h3>Cancelaciones aplicadas</h3>
            <div className="report-table-wrap">
              <table className="report-table">
                <caption>Vuelos cancelados considerados por el reporte</caption>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Fuente</th>
                    <th>Vuelo</th>
                    <th>Ruta</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.cancellations.length ? summary.cancellations.map((item) => (
                    <tr key={`${item.flightId}-${item.fechaCancelacion}-${item.sourceType ?? 'REAL'}`}>
                      <td>{formatCompactDate(item.fechaCancelacion)}</td>
                      <td>{item.sourceType === 'VIRTUAL' ? 'Virtual' : 'Real'}</td>
                      <td>{item.flightCodigo ?? '-'}</td>
                      <td>{item.origen ?? '-'} - {item.destino ?? '-'}</td>
                      <td>{item.flightId}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No hay cancelaciones aplicadas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-header">
              <h3>Rutas de envíos</h3>
              <label className="report-checkbox">
                <input
                  type="checkbox"
                  checked={impactedOnly}
                  onChange={(event) => setImpactedOnly(event.target.checked)}
                />
                Solo impactadas
              </label>
            </div>
            <div className="report-filters">
              <input
                value={routeQuery}
                onChange={(event) => setRouteQuery(event.target.value)}
                placeholder="Buscar pedido"
                aria-label="Buscar pedido"
              />
              <select value={routeEstado} onChange={(event) => setRouteEstado(event.target.value)} aria-label="Filtrar estado">
                <option value="">Todos los estados</option>
                <option value="ENTREGADO">Entregado</option>
                <option value="CON_RETRASO">Con retraso</option>
                <option value="SIN_RUTA_ENCONTRADA">Sin ruta</option>
              </select>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <caption>Rutas planificadas por envío</caption>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Estado</th>
                    <th>Ruta</th>
                    <th>Maletas</th>
                    <th>Tramos</th>
                    <th>Impacto</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {routesLoading ? (
                    <tr><td colSpan={7}>Cargando rutas...</td></tr>
                  ) : routes?.content.length ? routes.content.map((route) => (
                    <tr key={route.id}>
                      <td>{route.codigoPedido}</td>
                      <td>{route.estado}</td>
                      <td>{route.origen ?? '-'} - {route.destino ?? '-'}</td>
                      <td>{formatInteger(route.totalMaletas)}</td>
                      <td>{route.stepsCount}</td>
                      <td>{route.impacted ? 'Sí' : 'No'}</td>
                      <td>
                        <button className="report-link-button" onClick={() => handleRouteDetail(route.codigoPedido)}>
                          Ver ruta
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7}>No hay rutas para los filtros seleccionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {routes && (
              <div className="report-pager">
                <button disabled={routePage <= 0} onClick={() => setRoutePage((page) => Math.max(0, page - 1))}>Anterior</button>
                <span>Página {routes.number + 1} de {Math.max(1, routes.totalPages)}</span>
                <button disabled={routePage + 1 >= routes.totalPages} onClick={() => setRoutePage((page) => page + 1)}>Siguiente</button>
              </div>
            )}
          </div>

          {routeDetail && (
            <div className="report-section">
              <h3>Detalle de ruta {routeDetail.codigoPedido}</h3>
              <div className="report-table-wrap">
                <table className="report-table">
                  <caption>Tramos del envío seleccionado</caption>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vuelo base</th>
                      <th>Ruta</th>
                      <th>Salida</th>
                      <th>Llegada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeDetail.steps.length ? routeDetail.steps.map((step) => (
                      <tr key={`${routeDetail.id}-${step.stepIndex}`}>
                        <td>{step.stepIndex + 1}</td>
                        <td>{step.planId ?? step.vueloId}</td>
                        <td>{step.origen} - {step.destino}</td>
                        <td>{formatSimDateTimeFromMinute(step.salidaMin)}</td>
                        <td>{formatSimDateTimeFromMinute(step.llegadaMin)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5}>Este envío no tiene tramos planificados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="report-section">
            <div className="report-section-header">
              <h3>Rutas impactadas</h3>
              <select value={impactType} onChange={(event) => setImpactType(event.target.value)} aria-label="Filtrar tipo de impacto">
                <option value="">Todos los impactos</option>
                <option value="REASSIGNED">Reasignadas</option>
                <option value="WITHOUT_ROUTE">Sin ruta</option>
                <option value="CANCELLED_SEGMENT_REMOVED">Tramo cancelado</option>
              </select>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <caption>Envíos afectados por cancelaciones o replanificación</caption>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Tipo</th>
                    <th>Estado previo</th>
                    <th>Estado actual</th>
                    <th>Vuelo</th>
                  </tr>
                </thead>
                <tbody>
                  {impactsLoading ? (
                    <tr><td colSpan={5}>Cargando impactos...</td></tr>
                  ) : impacts?.content.length ? impacts.content.map((impact) => (
                    <tr key={impact.id}>
                      <td>{impact.codigoPedido}</td>
                      <td>{formatImpactType(impact.impactType)}</td>
                      <td>{impact.previousEstado ?? '-'}</td>
                      <td>{impact.currentEstado ?? '-'}</td>
                      <td>{impact.flightId ?? '-'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No hay rutas impactadas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {impacts && (
              <div className="report-pager">
                <button disabled={impactPage <= 0} onClick={() => setImpactPage((page) => Math.max(0, page - 1))}>Anterior</button>
                <span>Página {impacts.number + 1} de {Math.max(1, impacts.totalPages)}</span>
                <button disabled={impactPage + 1 >= impacts.totalPages} onClick={() => setImpactPage((page) => page + 1)}>Siguiente</button>
              </div>
            )}
          </div>

          {!summary && (
            <div className="report-section">
              <h3>Estadísticas finales</h3>
              <div className="report-bars">
                {stats.bars.map((bar: any, index: number) => (
                  <div className="report-bar-item" key={index}>
                    <div className="report-bar-label">
                      {bar.label}: {Math.round(bar.value)}%
                    </div>
                    <div className="report-bar-track">
                      <div className="report-bar-fill" style={{ width: `${Math.min(100, Math.max(0, bar.value))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <footer className="simulation-report-modal-footer">
          {exportError && <span className="report-export-error">{exportError}</span>}
          <button className="btn-secondary" onClick={handleExportCsv} disabled={!simId || !summary}>Exportar CSV</button>
          <button className="btn-secondary" onClick={handleExportPdf} disabled={!simId || !summary}>Exportar PDF</button>
          <button className="btn-primary" onClick={onClose}>Aceptar</button>
        </footer>
      </div>
    </div>
  )
}
