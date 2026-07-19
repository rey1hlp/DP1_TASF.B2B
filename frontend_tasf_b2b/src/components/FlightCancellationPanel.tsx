import { useMemo, useState } from 'react'
import { formatClockFromMinute, formatDateFromDayIndex, formatInteger, shiftAbsoluteMinuteByGmt } from '../utils/time'

export type CancellableFlightItem = {
  id: number
  instanceId?: number | null
  codigo?: string | null
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
  carga?: number | null
  capacidad?: number | null
  origenLat?: number | null
  origenLon?: number | null
  destinoLat?: number | null
  destinoLon?: number | null
  effectiveDate?: string | null
  effectiveNote?: string | null
}

type FlightCancellationPanelProps = {
  title: string
  description?: string
  flights: CancellableFlightItem[]
  disabled?: boolean
  loadingFlightId?: number | null
  emptyMessage?: string
  submitLabel?: string
  onCancel: (flight: CancellableFlightItem, reason: string) => Promise<void> | void
  airportGmtByCode?: Record<string, number>
}

function flightLabel(flight: CancellableFlightItem, gmtOffsets?: Record<string, number>) {
  const route = `${flight.origen} -> ${flight.destino}`
  const gmt = gmtOffsets?.[flight.origen]
  const localizedMinute = shiftAbsoluteMinuteByGmt(Math.floor(flight.salidaMin), gmt)
  
  const date = formatDateFromDayIndex(Math.floor(localizedMinute / 1440))
  const time = formatClockFromMinute(localizedMinute)
  const gmtSuffix = gmt !== undefined ? (gmt >= 0 ? `+${gmt}` : `${gmt}`) : 'UTC'
  
  return `${route} · ${date} ${time} (GMT${gmtSuffix})`
}

export default function FlightCancellationPanel({
  title,
  description,
  flights,
  disabled,
  loadingFlightId,
  emptyMessage = 'No hay vuelos disponibles para cancelar.',
  submitLabel = 'Cancelar vuelo',
  onCancel,
  airportGmtByCode,
}: FlightCancellationPanelProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const filteredFlights = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const sorted = [...flights].sort((a, b) => a.salidaMin - b.salidaMin)
    if (!normalized) {
      return sorted.slice(0, 80)
    }
    return sorted
      .filter((flight) => {
        const text = `${flight.codigo ?? ''} ${flight.origen} ${flight.destino} ${flight.id}`.toLowerCase()
        return text.includes(normalized)
      })
      .slice(0, 80)
  }, [flights, query])

  const selectedFlight = useMemo(() => {
    return filteredFlights.find((flight) => flight.id === selectedId) ?? filteredFlights[0] ?? null
  }, [filteredFlights, selectedId])

  const loading = selectedFlight !== null && loadingFlightId === selectedFlight.id

  return (
    <section className="flight-cancellation-panel" aria-labelledby="flight-cancellation-title">
      <div className="flight-cancellation-header">
        <div>
          <h3 id="flight-cancellation-title">{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>

      <label className="field">
        Buscar vuelo
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Origen, destino o ID"
          disabled={disabled}
        />
      </label>

      {filteredFlights.length === 0 ? (
        <div className="flight-cancellation-empty">{emptyMessage}</div>
      ) : (
        <>
          <label className="field">
            Vuelo
            <select
              value={selectedFlight?.id ?? ''}
              onChange={(event) => setSelectedId(Number(event.target.value))}
              disabled={disabled}
            >
              {filteredFlights.map((flight) => (
                <option key={`${flight.id}-${flight.salidaMin}`} value={flight.id}>
                  {flightLabel(flight, airportGmtByCode)}
                </option>
              ))}
            </select>
          </label>

          {selectedFlight ? (
            <div className="flight-cancellation-detail">
              <div>
                <span>Ruta</span>
                <strong>{selectedFlight.origen} {'->'} {selectedFlight.destino}</strong>
              </div>
              <div>
                <span>Salida</span>
                <strong>
                  {(() => {
                    const gmt = airportGmtByCode?.[selectedFlight.origen]
                    const localizedMinute = shiftAbsoluteMinuteByGmt(Math.floor(selectedFlight.salidaMin), gmt)
                    const gmtSuffix = gmt !== undefined ? (gmt >= 0 ? `+${gmt}` : `${gmt}`) : 'UTC'
                    return `${formatDateFromDayIndex(Math.floor(localizedMinute / 1440))} · ${formatClockFromMinute(localizedMinute)} (GMT${gmtSuffix})`
                  })()}
                </strong>
              </div>
              <div>
                <span>Carga</span>
                <strong>
                  {formatInteger(selectedFlight.carga)}
                  {selectedFlight.capacidad ? ` / ${formatInteger(selectedFlight.capacidad)}` : ''}
                </strong>
              </div>
              <div>
                <span>Fecha efectiva</span>
                <strong>{selectedFlight.effectiveDate ?? '-'}</strong>
              </div>
            </div>
          ) : null}

          {selectedFlight?.effectiveNote ? (
            <div className="flight-cancellation-note">{selectedFlight.effectiveNote}</div>
          ) : null}

          <label className="field">
            Motivo
            <input
              value={reason}
              maxLength={160}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Opcional"
              disabled={disabled}
            />
          </label>

          <button
            className="btn danger"
            type="button"
            disabled={disabled || !selectedFlight || loading}
            onClick={async () => {
              if (!selectedFlight) return
              await onCancel(selectedFlight, reason)
              setReason('')
            }}
          >
            {loading ? 'Cancelando...' : submitLabel}
          </button>
        </>
      )}
    </section>
  )
}
