// src/pages/DailyOperationPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import type { AirportDto } from '../types/sim'
import { fetchAirports } from '../services/api'
import MapView from '../components/MapView'
import DailyOperationControls from '../components/DailyOperationControls'

type MapViewProps = ComponentProps<typeof MapView>
type MapSegment = MapViewProps['segments'][number]
type WarehouseSnapshot = MapViewProps['warehouseSnapshot']

type FlightStatus =
  | 'PLANNED'
  | 'BOARDING'
  | 'IN_FLIGHT'
  | 'LANDED'
  | 'DELAYED'
  | 'CANCELLED'

type ShipmentSummary = {
  total: number
  pending: number
  inTransit: number
  delivered: number
}

type OperationAlert = {
  id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  message: string
  createdAt: string
}

type DailyOperationSnapshot = {
  timestamp?: string
  currentMinute?: number
  segments?: MapSegment[]
  warehouseSnapshot?: WarehouseSnapshot
  shipmentSummary?: ShipmentSummary
  alerts?: OperationAlert[]
}

type DailyOperationEvent =
  | {
      type: 'SNAPSHOT'
      payload: DailyOperationSnapshot
    }
  | {
      type: 'FLIGHTS_UPDATED'
      payload: {
        segments: MapSegment[]
      }
    }
  | {
      type: 'WAREHOUSE_UPDATED'
      payload: {
        warehouseSnapshot: WarehouseSnapshot
      }
    }
  | {
      type: 'SHIPMENTS_UPDATED'
      payload: {
        shipmentSummary: ShipmentSummary
      }
    }
  | {
      type: 'ALERT_CREATED'
      payload: OperationAlert
    }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function toWsUrl(httpUrl: string) {
  return httpUrl.replace(/^http/, 'ws')
}

function getCurrentMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getFlightStatusLabel(status?: FlightStatus) {
  if (status === 'PLANNED') return 'Planificado'
  if (status === 'BOARDING') return 'Embarcando'
  if (status === 'IN_FLIGHT') return 'En vuelo'
  if (status === 'LANDED') return 'Aterrizado'
  if (status === 'DELAYED') return 'Retrasado'
  if (status === 'CANCELLED') return 'Cancelado'

  return 'Planificado'
}

function getSegmentStatus(segment: MapSegment, currentMinute: number): FlightStatus {
  const salidaMin = Number(segment.salidaMin)
  const llegadaMin = Number(segment.llegadaMin)

  if (currentMinute < salidaMin) return 'PLANNED'
  if (currentMinute >= salidaMin && currentMinute <= llegadaMin) return 'IN_FLIGHT'
  return 'LANDED'
}

export default function DailyOperationPage() {
  const [airports, setAirports] = useState<AirportDto[]>([])
  const [segments, setSegments] = useState<MapSegment[]>([])
  const [warehouseSnapshot, setWarehouseSnapshot] = useState<WarehouseSnapshot>({})
  const [shipmentSummary, setShipmentSummary] = useState<ShipmentSummary | null>(null)
  const [alerts, setAlerts] = useState<OperationAlert[]>([])

  const [now, setNow] = useState(() => new Date())
  const [backendMinute, setBackendMinute] = useState<number | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)

  const [ranges, setRanges] = useState({ greenMax: 30, amberMax: 70 })
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)
  const [selectedAirportCode, setSelectedAirportCode] = useState<string | null>(null)

  const currentMinute = backendMinute ?? getCurrentMinuteOfDay(now)

  const applySnapshot = useCallback((snapshot: DailyOperationSnapshot) => {
    if (snapshot.currentMinute !== undefined) {
      setBackendMinute(snapshot.currentMinute)
    }

    if (snapshot.segments) {
      setSegments(snapshot.segments)
    }

    if (snapshot.warehouseSnapshot) {
      setWarehouseSnapshot(snapshot.warehouseSnapshot)
    }

    if (snapshot.shipmentSummary) {
      setShipmentSummary(snapshot.shipmentSummary)
    }

    if (snapshot.alerts) {
      setAlerts(snapshot.alerts)
    }

    if (snapshot.timestamp) {
      setLastSyncAt(snapshot.timestamp)
    } else {
      setLastSyncAt(new Date().toISOString())
    }
  }, [])

  const fetchDailyOperationSnapshot = useCallback(async () => {
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/operation/daily`)

      if (!response.ok) {
        throw new Error('No se pudo obtener la operación diaria.')
      }

      const snapshot = (await response.json()) as DailyOperationSnapshot
      applySnapshot(snapshot)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [applySnapshot])

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    fetchDailyOperationSnapshot()
  }, [fetchDailyOperationSnapshot])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const socketUrl = `${toWsUrl(API_BASE_URL)}/operation/daily/stream`
    const socket = new WebSocket(socketUrl)

    socket.onopen = () => {
      setSocketConnected(true)
    }

    socket.onclose = () => {
      setSocketConnected(false)
    }

    socket.onerror = () => {
      setSocketConnected(false)
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as DailyOperationEvent

        if (message.type === 'SNAPSHOT') {
          applySnapshot(message.payload)
          return
        }

        if (message.type === 'FLIGHTS_UPDATED') {
          setSegments(message.payload.segments)
          setLastSyncAt(new Date().toISOString())
          return
        }

        if (message.type === 'WAREHOUSE_UPDATED') {
          setWarehouseSnapshot(message.payload.warehouseSnapshot)
          setLastSyncAt(new Date().toISOString())
          return
        }

        if (message.type === 'SHIPMENTS_UPDATED') {
          setShipmentSummary(message.payload.shipmentSummary)
          setLastSyncAt(new Date().toISOString())
          return
        }

        if (message.type === 'ALERT_CREATED') {
          setAlerts((prev) => [message.payload, ...prev])
          setLastSyncAt(new Date().toISOString())
        }
      } catch {
        setError('Se recibió un evento inválido desde operación diaria.')
      }
    }

    return () => {
      socket.close()
    }
  }, [applySnapshot])

  const airportsByCode = useMemo(() => {
    const map: Record<string, AirportDto> = {}

    airports.forEach((airport) => {
      map[airport.codigoOaci] = airport
    })

    return map
  }, [airports])

  const activeSegments = useMemo(() => {
    return segments.filter(
      (segment) => currentMinute >= segment.salidaMin && currentMinute <= segment.llegadaMin
    )
  }, [segments, currentMinute])

  const upcomingSegments = useMemo(() => {
    return segments
      .filter((segment) => segment.salidaMin > currentMinute)
      .sort((a, b) => a.salidaMin - b.salidaMin)
      .slice(0, 10)
  }, [segments, currentMinute])

  const totalFlights = segments.length;
  const totalActiveFlights = activeSegments.length;

  const warehouseItems = useMemo(() => {
    const entries = Object.entries(warehouseSnapshot).map(([codigo, data]) => {
      const airport = airportsByCode[codigo]
      const percent = data.porcentaje

      let color = '#54b86c'

      if (percent > ranges.amberMax) {
        color = '#e36b60'
      } else if (percent > ranges.greenMax) {
        color = '#f0be62'
      }

      return {
        codigoOaci: codigo,
        nombre: airport?.nombre ?? codigo,
        pais: airport?.pais ?? '--',
        porcentaje: percent,
        color,
      }
    })

    return entries.sort((a, b) => b.porcentaje - a.porcentaje)
  }, [warehouseSnapshot, airportsByCode, ranges])

  const stats = useMemo(() => {
    const totalFlights = segments.length
    const totalActive = activeSegments.length
    const totalCargo = activeSegments.reduce((acc, segment) => acc + segment.carga, 0)
    const totalCapacity = activeSegments.reduce(
      (acc, segment) => acc + (segment.capacidad ?? 0),
      0
    )
  
    const capacityPct = totalCapacity > 0 ? (totalCargo * 100) / totalCapacity : 0
    const activePct = totalFlights > 0 ? (totalActive * 100) / totalFlights : 0
  
    const shipmentProgressPct = shipmentSummary?.total
      ? ((shipmentSummary.delivered + shipmentSummary.inTransit) * 100) /
        shipmentSummary.total
      : 0
  
    return {
      cards: [
        { label: 'Vuelos activos', value: `${totalActive}` },
        { label: 'Vuelos planificados', value: `${totalFlights}` },
        { label: 'Carga en aire', value: `${Math.round(totalCargo)}` },
        { label: 'Capacidad usada', value: `${capacityPct.toFixed(1)}%` },
      ],
      bars: [
        { label: 'Actividad de vuelos', value: activePct },
        { label: 'Capacidad usada', value: capacityPct },
        { label: 'Avance de envíos', value: shipmentProgressPct },
      ],
    }
  }, [segments, activeSegments, shipmentSummary])

  const activeFlightItems = useMemo(() => {
    return activeSegments.map((segment) => ({
      flightId: segment.flightId,
      origen: segment.origen,
      destino: segment.destino,
      salidaMin: segment.salidaMin,
      llegadaMin: segment.llegadaMin,
      estado: getFlightStatusLabel(getSegmentStatus(segment, currentMinute)),
    }))
  }, [activeSegments, currentMinute])
  
  const upcomingFlightItems = useMemo(() => {
    return upcomingSegments.map((segment) => ({
      flightId: segment.flightId,
      origen: segment.origen,
      destino: segment.destino,
      salidaMin: segment.salidaMin,
      llegadaMin: segment.llegadaMin,
      estado: getFlightStatusLabel(getSegmentStatus(segment, currentMinute)),
    }))
  }, [upcomingSegments, currentMinute])
  
  const airportItems = useMemo(() => {
    return airports.map((airport) => ({
      codigoOaci: airport.codigoOaci,
      nombre: airport.nombre,
      pais: airport.pais,
    }))
  }, [airports])
  
  const lastSyncLabel = lastSyncAt ? formatDateTime(new Date(lastSyncAt)) : '--'

  const handleSelectFlight = (flightId: number) => {
    setSelectedFlightId((prev) => (prev === flightId ? null : flightId))
  }

  const handleSelectAirport = (codigoOaci: string) => {
    setSelectedAirportCode((prev) => (prev === codigoOaci ? null : codigoOaci))
  }

  return (
    <>
      <section className="toolbar">
        <div className="tabs">
          <button className="tab active">Operación diaria</button>
        </div>

        <div className="status">
          <div className="status-item">
            Hora actual: <strong>{formatDateTime(now)}</strong>
          </div>

          <div className="status-item">
            Vuelos activos: <strong>{totalActiveFlights}</strong>
          </div>

          <div className="status-item">
            Vuelos planificados: <strong>{totalFlights}</strong>
          </div>

          <div className="status-item">
            Conexión:{" "}
            <strong>
              {socketConnected ? "En vivo" : "Sin conexión"}
            </strong>
          </div>
        </div>
      </section>

      <section className="map-area">
        <div className="map-placeholder">
          <MapView
            airports={airports}
            segments={segments}
            currentMinute={currentMinute}
            warehouseSnapshot={warehouseSnapshot}
            ranges={ranges}
            selectedFlightId={selectedFlightId}
            selectedAirportCode={selectedAirportCode}
          />

          {loading ? (
            <div className="prep-overlay">Cargando operación diaria...</div>
          ) : null}

          {error ? <div className="error">{error}</div> : null}
        </div>

        <DailyOperationControls
          onRefresh={fetchDailyOperationSnapshot}
          loading={loading}
          socketConnected={socketConnected}
          lastSyncLabel={lastSyncLabel}
          ranges={ranges}
          onRangesChange={setRanges}
          stats={stats}
          shipmentSummary={shipmentSummary}
          warehouseItems={warehouseItems}
          flightItems={activeFlightItems}
          upcomingFlightItems={upcomingFlightItems}
          selectedFlightId={selectedFlightId}
          onSelectFlight={handleSelectFlight}
          airportItems={airportItems}
          selectedAirportCode={selectedAirportCode}
          onSelectAirport={handleSelectAirport}
          alerts={alerts}
        />
      </section>
    </>
  );
}