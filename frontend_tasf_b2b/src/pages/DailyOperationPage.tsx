// src/pages/DailyOperationPage.tsx

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import type { ComponentProps } from 'react'
import type { AirportDto } from '../types/sim'
import { fetchAirports } from '../services/api'
import MapView from '../components/MapView'
import DailyOperationControls from '../components/DailyOperationControls'
import { DEFAULT_MAP_SEMAPHORE_FILTERS } from '../types/mapFilters'
import type { EntityFocusRequest } from '../types/entityFocus'
import {
  filterAirportsByMapFilters,
  filterFlightSegmentsByMapFilters,
} from '../utils/mapFilters'
import { resolveSemaphoreColor } from '../utils/semaphore'
import { formatBags, formatDateTime, formatInteger, formatPercent } from '../utils/time'

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
  assigned: number
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
  envios?: any[]
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

const API_BASE_URL = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

function toWsUrl(httpUrl: string) {
  return httpUrl.replace(/^http/, 'ws')
}

function getCurrentMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
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
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)

  const [ranges, setRanges] = useState({ greenMax: 30, amberMax: 70 })
  const [mapFilters, setMapFilters] = useState(DEFAULT_MAP_SEMAPHORE_FILTERS)
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)
  const [selectedAirportCode, setSelectedAirportCode] = useState<string | null>(null)

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true)

  const [sampleShipments, setSampleShipments] = useState<string[]>([])
  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState<any | null>(null)
  const [shipmentSearchError, setShipmentSearchError] = useState<string | null>(null)
  const [entityFocusRequest, setEntityFocusRequest] = useState<EntityFocusRequest | null>(null)
  const entityFocusRequestIdRef = useRef(0)

  const handleSearchShipment = async (codigo: string) => {
    setShipmentSearchError(null)
    try {
      // Intentar primero obtener la ruta real del endpoint de operación diaria
      const routeRes = await fetch(`${API_BASE_URL}/api/operation/daily/shipments/${encodeURIComponent(codigo)}/route`)
      if (routeRes.ok) {
        const routeData = await routeRes.json()
        // Asegurar que no se dibuje la línea si ya se entregó o canceló
        if (routeData.estado === 'DELIVERED' || routeData.estado === 'CANCELLED') {
          routeData.ruta = []
        }
        setSelectedFlightId(null)
        setSelectedAirportCode(null)
        setSelectedShipmentRoute(routeData)
        return
      }

      // Fallback si la maleta aún no tiene ruta planificada o el endpoint falla
      const fallbackRes = await fetch(`${API_BASE_URL}/api/db/shipments?query=${encodeURIComponent(codigo)}`)
      const fallbackData = await fallbackRes.json()
      if (fallbackData.content && fallbackData.content.length > 0) {
        const shipment = fallbackData.content.find((s: any) => s.codigoPedido === codigo)
        if (shipment) {
          setSelectedFlightId(null)
          setSelectedAirportCode(null)
          setSelectedShipmentRoute({
            codigoPedido: shipment.codigoPedido,
            estado: shipment.status,
            tiempoTotalHoras: shipment.slaHoras,
            ruta: (shipment.status === 'DELIVERED' || shipment.status === 'CANCELLED')
              ? []
              : [{ vueloId: '--', origen: shipment.origen, destino: shipment.destino, salidaMin: 0, llegadaMin: 0 }]
          })
          return
        }
      }
      setSelectedShipmentRoute(null)
      setShipmentSearchError('No se encontró el envío en operación diaria.')
    } catch (e) {
      setSelectedShipmentRoute(null)
      setShipmentSearchError('Error al buscar el envío.')
    }
  }

  const currentMinute = useMemo(() => getCurrentMinuteOfDay(now), [now])

  const applySnapshot = useCallback((snapshot: DailyOperationSnapshot) => {
    console.debug('[DailyOperationPage] applySnapshot', snapshot)
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

    if (snapshot.envios) {
      setSampleShipments(snapshot.envios.map((s: any) => s.codigoPedido))
    }

    if (snapshot.timestamp) {
      setLastSyncAt(snapshot.timestamp)
    } else {
      setLastSyncAt(new Date().toISOString())
    }
  }, [])

  const fetchDailyOperationSnapshot = useCallback(async () => {
    setError(null)
    console.debug('[DailyOperationPage] fetch snapshot')

    try {
      const response = await fetch(`${API_BASE_URL}/api/operation/daily`)

      if (!response.ok) {
        throw new Error('No se pudo obtener la operación diaria.')
      }

      const snapshot = (await response.json()) as DailyOperationSnapshot
      console.debug('[DailyOperationPage] fetch snapshot result', snapshot)
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
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
      // ✅ Si ya hay conexión abierta, no crear otra
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      const socketUrl = `${toWsUrl(API_BASE_URL)}/api/operation/daily/stream`
      console.log('[WS] Connecting to:', socketUrl)
      const socket = new WebSocket(socketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        console.log('[WS] ✅ Connected')
        setSocketConnected(true)
      }

      socket.onclose = (event) => {
        console.log('[WS] ❌ Closed:', event.code, event.reason)
        setSocketConnected(false)
      }

      socket.onerror = (error) => {
        console.error('[WS] ⚠️ Error:', error)
        setSocketConnected(false)
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as DailyOperationEvent
          console.log('[WS] Message received:', message.type)

          if (message.type === 'SNAPSHOT') {
            applySnapshot(message.payload)
            return
          }
          // ... resto igual
        } catch (err) {
          console.error('[WS] Parse error:', err)
          setError('Se recibió un evento inválido desde operación diaria.')
        }
      }

      return () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close()
        }
      }
    }, [applySnapshot])

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

  const mapSegments = useMemo(() => {
    return filterFlightSegmentsByMapFilters(segments, mapFilters, ranges)
  }, [segments, mapFilters, ranges])

  const mapAirports = useMemo(() => {
    return filterAirportsByMapFilters(airports, warehouseSnapshot, mapFilters, ranges)
  }, [airports, warehouseSnapshot, mapFilters, ranges])

  const mapFilterCounts = useMemo(() => ({
    flights: mapSegments.length,
    warehouses: mapAirports.length,
  }), [mapAirports.length, mapSegments.length])

  useEffect(() => {
    if (
      selectedFlightId !== null &&
      !mapSegments.some((segment) => segment.flightId === selectedFlightId)
    ) {
      setSelectedFlightId(null)
    }
  }, [mapSegments, selectedFlightId])

  useEffect(() => {
    if (
      selectedAirportCode !== null &&
      !mapAirports.some((airport) => airport.codigoOaci === selectedAirportCode)
    ) {
      setSelectedAirportCode(null)
    }
  }, [mapAirports, selectedAirportCode])

  const totalFlights = segments.length;
  const totalActiveFlights = activeSegments.length;

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
      ? ((shipmentSummary.delivered + shipmentSummary.inTransit + shipmentSummary.assigned) * 100) /
        shipmentSummary.total
      : 0
  
    return {
      cards: [
        { label: 'Vuelos activos', value: formatInteger(totalActive) },
        { label: 'Vuelos planificados', value: formatInteger(totalFlights) },
        { label: 'Maletas en aire', value: formatBags(totalCargo) },
        { label: 'Capacidad usada', value: formatPercent(capacityPct) },
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
      carga: segment.carga,
      capacidad: segment.capacidad,
      porcentaje:
        segment.capacidad !== undefined && segment.capacidad > 0
          ? (segment.carga * 100) / segment.capacidad
          : undefined,
      color:
        segment.capacidad !== undefined && segment.capacidad > 0
          ? resolveSemaphoreColor((segment.carga * 100) / segment.capacidad, ranges).fill
          : undefined,
    }))
  }, [activeSegments, currentMinute, ranges])
  
  const upcomingFlightItems = useMemo(() => {
    return upcomingSegments.map((segment) => ({
      flightId: segment.flightId,
      origen: segment.origen,
      destino: segment.destino,
      salidaMin: segment.salidaMin,
      llegadaMin: segment.llegadaMin,
      estado: getFlightStatusLabel(getSegmentStatus(segment, currentMinute)),
      carga: segment.carga,
      capacidad: segment.capacidad,
      porcentaje:
        segment.capacidad !== undefined && segment.capacidad > 0
          ? (segment.carga * 100) / segment.capacidad
          : undefined,
      color:
        segment.capacidad !== undefined && segment.capacidad > 0
          ? resolveSemaphoreColor((segment.carga * 100) / segment.capacidad, ranges).fill
          : undefined,
    }))
  }, [upcomingSegments, currentMinute, ranges])
  
  const airportItems = useMemo(() => {
    return airports.map((airport) => ({
      codigoOaci: airport.codigoOaci,
      nombre: airport.nombre,
      pais: airport.pais,
      capacidad: warehouseSnapshot[airport.codigoOaci]?.capacidad ?? airport.capacidad,
      ocupacion: warehouseSnapshot[airport.codigoOaci]?.ocupacion,
      porcentaje: warehouseSnapshot[airport.codigoOaci]?.porcentaje,
      color: warehouseSnapshot[airport.codigoOaci]
        ? resolveSemaphoreColor(warehouseSnapshot[airport.codigoOaci].porcentaje, ranges).fill
        : undefined,
    }))
  }, [airports, warehouseSnapshot, ranges])
  
  const lastSyncLabel = formatDateTime(lastSyncAt)

  const handleSelectFlight = (flightId: number) => {
    const nextFlightId = selectedFlightId === flightId ? null : flightId
    setSelectedFlightId(nextFlightId)
    if (nextFlightId !== null) {
      setSelectedAirportCode(null)
      setSelectedShipmentRoute(null)
      setShipmentSearchError(null)
    }
  }

  const handleSelectAirport = (codigoOaci: string) => {
    const nextAirportCode = selectedAirportCode === codigoOaci ? null : codigoOaci
    setSelectedAirportCode(nextAirportCode)
    if (nextAirportCode !== null) {
      setSelectedFlightId(null)
      setSelectedShipmentRoute(null)
      setShipmentSearchError(null)
    }
  }

  const handleMapAirportPreview = useCallback((codigoOaci: string | null) => {
    if (codigoOaci === null) {
      setSelectedAirportCode(null)
      return
    }

    setSelectedAirportCode(codigoOaci)
    setSelectedFlightId(null)
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
  }, [])

  const handleMapAirportDetailRequest = useCallback((codigoOaci: string) => {
    entityFocusRequestIdRef.current += 1
    handleMapAirportPreview(codigoOaci)
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'airport',
      id: codigoOaci,
      requestId: entityFocusRequestIdRef.current,
    })
  }, [handleMapAirportPreview])

  const handleMapFlightPreview = useCallback((flightId: number | null) => {
    if (flightId === null) {
      setSelectedFlightId(null)
      return
    }

    setSelectedFlightId(flightId)
    setSelectedAirportCode(null)
    setSelectedShipmentRoute(null)
    setShipmentSearchError(null)
  }, [])

  const handleMapFlightDetailRequest = useCallback((flightId: number) => {
    entityFocusRequestIdRef.current += 1
    handleMapFlightPreview(flightId)
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'flight',
      id: flightId,
      requestId: entityFocusRequestIdRef.current,
    })
  }, [handleMapFlightPreview])

  return (
    <div className="daily-operation-page">
      <section className={`toolbar`}>
        <div className="status">
          <div className="status-item">
            Hora actual: <strong>{formatDateTime(now)}</strong>
          </div>

          <div className="status-item">
            Vuelos activos: <strong>{formatInteger(totalActiveFlights)}</strong>
          </div>

          <div className="status-item">
            Vuelos planificados: <strong>{formatInteger(totalFlights)}</strong>
          </div>

          <div className="status-item">
            Conexión:{" "}
            <strong>{socketConnected ? "En vivo" : "Sin conexión"}</strong>
          </div>
        </div>
      </section>

      <section
        className={`map-area ${isPanelCollapsed ? "panel-collapsed" : ""}`}
      >
        <div className="map-placeholder">
          <MapView
            airports={mapAirports}
            segments={mapSegments}
            currentMinute={currentMinute}
            warehouseSnapshot={warehouseSnapshot}
            ranges={ranges}
            selectedFlightId={selectedFlightId}
            selectedAirportCode={selectedAirportCode}
            isPanelCollapsed={isPanelCollapsed}
            onAirportPreview={handleMapAirportPreview}
            onAirportDetailRequest={handleMapAirportDetailRequest}
            onFlightPreview={handleMapFlightPreview}
            onFlightDetailRequest={handleMapFlightDetailRequest}
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
          mapFilters={mapFilters}
          onMapFiltersChange={setMapFilters}
          mapFilterCounts={mapFilterCounts}
          stats={stats}
          shipmentSummary={shipmentSummary}
          flightItems={activeFlightItems}
          upcomingFlightItems={upcomingFlightItems}
          selectedFlightId={selectedFlightId}
          onSelectFlight={handleSelectFlight}
          airportItems={airportItems}
          selectedAirportCode={selectedAirportCode}
          onSelectAirport={handleSelectAirport}
          selectedShipmentRoute={selectedShipmentRoute}
          onSearchShipment={handleSearchShipment}
          shipmentSearchError={shipmentSearchError}
          sampleShipments={sampleShipments}
          currentMinute={currentMinute}
          alerts={alerts}
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
          entityFocusRequest={entityFocusRequest}
        />
      </section>
    </div>
  );
}
