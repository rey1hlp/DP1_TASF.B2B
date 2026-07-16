import { useState } from 'react'
import type { FormEvent } from 'react'
import { Package, Search, X } from 'lucide-react'
import { formatDurationHours, formatMinuteRange } from '../utils/time'

export type TrackerRouteStep = {
  vueloId?: number | string
  planId?: number | string | null
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
}

export type TrackerShipmentRoute = {
  codigoPedido?: string
  codigoMaleta?: string
  numeroMaleta?: number
  totalMaletas?: number
  consultaMaleta?: boolean
  estado?: string
  tiempoTotalHoras?: number
  ruta: TrackerRouteStep[]
}

type ShipmentRouteTrackerProps = {
  selectedShipmentRoute?: TrackerShipmentRoute | null
  shipmentSearchError?: string | null
  currentMinute?: number | null
  trackedCode?: string | null
  isOpen?: boolean
  onSearchShipment?: (codigo: string) => void | Promise<void>
  onClearShipmentRoute?: () => void
  onTrackedCodeChange?: (codigo: string | null) => void
  onOpenChange?: (isOpen: boolean) => void
}

function formatStatus(status?: string) {
  if (!status) return 'Sin estado'
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeCode(value?: string) {
  return value?.trim().toLowerCase() ?? ''
}

function getStatusKind(status?: string, hasRoute = false) {
  const normalized = status?.toUpperCase()
  if (normalized === 'DELIVERED' || normalized === 'ENTREGADO') return 'delivered'
  if (normalized === 'CANCELLED' || normalized === 'CANCELADO') return 'cancelled'
  if (normalized === 'SIN_RUTA_ENCONTRADA' || !hasRoute) return 'no-route'
  return 'active'
}

function getStepState(step: TrackerRouteStep, currentMinute?: number | null) {
  if (currentMinute == null) return 'pending'
  if (currentMinute >= step.salidaMin && currentMinute <= step.llegadaMin) return 'active'
  if (currentMinute > step.llegadaMin) return 'done'
  return 'pending'
}

function getEmptyRouteMessage(status?: string) {
  const kind = getStatusKind(status, false)
  if (kind === 'delivered') return 'La maleta ya fue entregada'
  if (kind === 'cancelled') return 'El envio fue cancelado'
  return 'Sin ruta planificada'
}

function getDynamicShipmentState(route: TrackerShipmentRoute, currentMinute?: number | null): string {
  if (!route.ruta || route.ruta.length === 0) return route.estado || 'SIN RUTA'
  if (route.estado?.toUpperCase() === 'CANCELADO' || route.estado?.toUpperCase() === 'CANCELLED') return route.estado

  if (currentMinute == null) return route.estado || 'DESCONOCIDO'

  const firstStep = route.ruta[0]
  const lastStep = route.ruta[route.ruta.length - 1]

  if (currentMinute < firstStep.salidaMin) return 'PLANIFICADO'
  if (currentMinute > lastStep.llegadaMin) return 'ENTREGADO'
  
  return 'EN TRANSITO'
}

export default function ShipmentRouteTracker({
  selectedShipmentRoute,
  shipmentSearchError,
  currentMinute,
  trackedCode,
  isOpen: controlledIsOpen,
  onSearchShipment,
  onClearShipmentRoute,
  onTrackedCodeChange,
  onOpenChange,
}: ShipmentRouteTrackerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [internalTrackedCode, setInternalTrackedCode] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const isOpen = controlledIsOpen ?? internalIsOpen
  const lastSubmittedCode = trackedCode ?? internalTrackedCode
  const submittedCode = normalizeCode(lastSubmittedCode ?? undefined)
  const routeMatchesSubmitted =
    submittedCode.length > 0 &&
    Boolean(selectedShipmentRoute) &&
    (
      normalizeCode(selectedShipmentRoute?.codigoMaleta) === submittedCode ||
      normalizeCode(selectedShipmentRoute?.codigoPedido) === submittedCode
    )
  const route = routeMatchesSubmitted ? selectedShipmentRoute : null
  const visibleError = submittedCode.length > 0 ? shipmentSearchError : null
  const showClear = Boolean(route || visibleError || localError)
  const displayedCode = route?.codigoMaleta || route?.codigoPedido || 'Sin seleccion'
  const dynamicState = route ? getDynamicShipmentState(route, currentMinute) : undefined
  const statusKind = getStatusKind(dynamicState, Boolean(route?.ruta.length))
  const pieceLabel =
    route?.numeroMaleta && route?.totalMaletas
      ? `${route.numeroMaleta} de ${route.totalMaletas}`
      : route?.totalMaletas
        ? `${route.totalMaletas} maletas`
        : '--'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || !onSearchShipment) {
      setLocalError('Ingresa un ID')
      return
    }

    setLocalError(null)
    setInternalTrackedCode(trimmed)
    onTrackedCodeChange?.(trimmed)
    setIsSearching(true)
    try {
      await onSearchShipment(trimmed)
    } finally {
      setIsSearching(false)
    }
  }

  const handleClear = () => {
    onClearShipmentRoute?.()
    setInternalTrackedCode(null)
    onTrackedCodeChange?.(null)
    setLocalError(null)
  }

  const setOpen = (nextOpen: boolean) => {
    setInternalIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className={`shipment-tracker-toggle ${route ? 'has-route' : ''}`}
        onClick={() => setOpen(true)}
        title="Rastrear maleta"
        aria-label="Rastrear maleta"
      >
        <Package size={17} />
        <span>Rastrear maleta</span>
      </button>
    )
  }

  return (
    <aside className="shipment-tracker-panel" aria-label="Rastreador de maleta">
      <header className="shipment-tracker-header">
        <div className="shipment-tracker-title">
          <Package size={18} />
          <strong>Rastrear maleta</strong>
        </div>
        <button
          type="button"
          className="shipment-tracker-icon-btn"
          onClick={() => setOpen(false)}
          title="Cerrar"
          aria-label="Cerrar rastreador"
        >
          <X size={18} />
        </button>
      </header>

      <form className="shipment-tracker-search" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SPJC-00012345-002"
          aria-label="ID de maleta o envio"
        />
        <button type="submit" disabled={isSearching || !onSearchShipment} title="Buscar ruta">
          <Search size={17} />
        </button>
      </form>

      {(localError || visibleError) && (
        <div className="shipment-tracker-error">
          <strong>No encontrada</strong>
          <span>{localError || visibleError}</span>
        </div>
      )}

      {route ? (
        <div className="shipment-tracker-result">
          <div className="shipment-tracker-summary">
            <div>
              <span>ID</span>
              <strong>{displayedCode}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong className={`shipment-tracker-state ${statusKind}`}>
                {route.ruta.length === 0 ? getEmptyRouteMessage(dynamicState) : formatStatus(dynamicState)}
              </strong>
            </div>
            <div>
              <span>Envio</span>
              <strong>{route.codigoPedido || '--'}</strong>
            </div>
            <div>
              <span>Pieza</span>
              <strong>{pieceLabel}</strong>
            </div>
          </div>

          <div className="shipment-tracker-meta">
            <span>Tiempo total</span>
            <strong>{formatDurationHours(route.tiempoTotalHoras ?? 0)}</strong>
          </div>

          <div className="shipment-tracker-route">
            {route.ruta.length === 0 ? (
              <div className={`shipment-tracker-empty ${statusKind}`}>
                {getEmptyRouteMessage(route.estado)}
              </div>
            ) : (
              route.ruta.map((step, index) => (
                <div
                  className={`shipment-tracker-step ${getStepState(step, currentMinute)}`}
                  key={`${step.vueloId}-${step.origen}-${step.destino}-${index}`}
                >
                  <span>{step.planId ?? step.vueloId ?? '--'}</span>
                  <strong>{step.origen} → {step.destino}</strong>
                  <small>{formatMinuteRange(step.salidaMin, step.llegadaMin)}</small>
                </div>
              ))
            )}
          </div>

          <button type="button" className="shipment-tracker-clear" onClick={handleClear}>
            Limpiar ruta
          </button>
        </div>
      ) : showClear ? (
        <div className="shipment-tracker-result">
          <button type="button" className="shipment-tracker-clear" onClick={handleClear}>
            Limpiar ruta
          </button>
        </div>
      ) : null}
    </aside>
  )
}
