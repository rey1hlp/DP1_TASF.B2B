// src/pages/DailyOperationPage.tsx

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import type { ComponentProps } from 'react'
import type { AirportDto, FlightCrudDto, ShipmentCrudDto } from '../types/sim'
import { API_BASE, authFetch, buildDailyOperationWsUrl, fetchAirports, listFlights } from '../services/api'
import MapView from '../components/MapView'
import DailyOperationControls, { type RespuestaRutaEnvioDto } from '../components/DailyOperationControls'
import { DEFAULT_MAP_SEMAPHORE_FILTERS } from '../types/mapFilters'
import type { EntityFocusRequest } from '../types/entityFocus'
import {
  buildAirportFlightTimings,
  filterAirportsByMapFilters,
  filterFlightSegmentsByMapFilters,
} from '../utils/mapFilters'
import { resolveAirportContinent } from '../utils/continents'
import { resolveSemaphoreColor, resolveSemaphoreLevel } from '../utils/semaphore'
import { formatBags, formatDateTime, formatInteger, formatPercent } from '../utils/time'
import { buildCancelledFlightTraces, readCancelledFlightDays } from '../utils/cancelledFlightTraces'

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
  envios?: ShipmentCrudDto[]
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

function syncSelectedShipmentRoute(
  currentRoute: RespuestaRutaEnvioDto | null,
  shipments?: ShipmentCrudDto[]
) {
  if (!currentRoute || !shipments?.length) {
    return currentRoute
  }

  const selectedShipment = shipments.find(
    (shipment) => shipment.codigoPedido === currentRoute.codigoPedido
  )

  if (!selectedShipment?.status) {
    return currentRoute
  }

  const shouldHideRoute =
    selectedShipment.status === 'DELIVERED' || selectedShipment.status === 'CANCELLED'
  const nextRoute = shouldHideRoute ? [] : currentRoute.ruta

  const statusChanged = currentRoute.estado !== selectedShipment.status
  const routeChanged = shouldHideRoute && currentRoute.ruta.length > 0

  if (!statusChanged && !routeChanged) {
    return currentRoute
  }

  return {
    ...currentRoute,
    estado: selectedShipment.status,
    ruta: nextRoute,
  }
}

function getLimaDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

async function fetchShipmentFromDb(codigo: string): Promise<ShipmentCrudDto | null> {
  const response = await authFetch(
    `${API_BASE}/api/db/shipments?query=${encodeURIComponent(codigo)}`
  )

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  if (!data.content || !Array.isArray(data.content)) {
    return null
  }

  return data.content.find((shipment: ShipmentCrudDto) => shipment.codigoPedido === codigo) ?? null
}

export default function DailyOperationPage() {
  const [airports, setAirports] = useState<AirportDto[]>([])
  const [flightCatalog, setFlightCatalog] = useState<FlightCrudDto[]>([])
  const [cancelledDays, setCancelledDays] = useState(() => readCancelledFlightDays({ includeVirtual: false }))
  const [segments, setSegments] = useState<MapSegment[]>([])
  const [warehouseSnapshot, setWarehouseSnapshot] = useState<WarehouseSnapshot>({})
  const [shipmentSummary, setShipmentSummary] = useState<ShipmentSummary | null>(null)
  const [alerts, setAlerts] = useState<OperationAlert[]>([])

  const [now, setNow] = useState(() => new Date())
  const [serverCurrentMinute, setServerCurrentMinute] = useState<number | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)

  const [ranges, setRanges] = useState({ greenMax: 30, amberMax: 70 })
  const [mapFilters, setMapFilters] = useState(DEFAULT_MAP_SEMAPHORE_FILTERS)
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)
  const [selectedAirportCode, setSelectedAirportCode] = useState<string | null>(null)

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = sessionStorage.getItem('ops_panel_width')
    return saved ? parseInt(saved, 10) : 320
  })

  useEffect(() => {
    sessionStorage.setItem('ops_panel_width', panelWidth.toString())
  }, [panelWidth])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      setPanelWidth(Math.max(250, Math.min(800, startWidth + delta)))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'ew-resize'
  }

  const [sampleShipments, setSampleShipments] = useState<string[]>([])
  const [shipmentQuantities, setShipmentQuantities] = useState<Record<string, number>>({})
  const [shipmentFlightIds, setShipmentFlightIds] = useState<Record<string, string[]>>({})
  const [shipmentClientIds, setShipmentClientIds] = useState<Record<string, string | null | undefined>>({})
  const [showCancelledDetails, setShowCancelledDetails] = useState(true)
  const [selectedShipmentRoute, setSelectedShipmentRoute] = useState<RespuestaRutaEnvioDto | null>(null)
  const [shipmentSearchError, setShipmentSearchError] = useState<string | null>(null)
  const [entityFocusRequest, setEntityFocusRequest] = useState<EntityFocusRequest | null>(null)
  const entityFocusRequestIdRef = useRef(0)

  const handleSearchShipment = async (codigo: string) => {
    // Toggle: si ya está seleccionado, deseleccionar
    if (selectedShipmentRoute?.codigoPedido === codigo) {
      setSelectedShipmentRoute(null)
      setEntityFocusRequest(null)
      return
    }

    setShipmentSearchError(null)
    try {
      // Intentar primero obtener la ruta real del endpoint de operación diaria
      const routeRes = await authFetch(`${API_BASE}/api/operation/daily/shipments/${encodeURIComponent(codigo)}/route`)
      if (routeRes.ok) {
        const routeData = await routeRes.json()
        const dbShipment = await fetchShipmentFromDb(codigo)
        if (dbShipment?.status) {
          routeData.estado = dbShipment.status
        }
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
      const shipment = await fetchShipmentFromDb(codigo)
      if (shipment) {
        setSelectedFlightId(null)
        setSelectedAirportCode(null)
        setSelectedShipmentRoute({
          codigoPedido: shipment.codigoPedido,
          estado: shipment.status ?? 'PENDING',
          tiempoTotalHoras: shipment.slaHoras,
          ruta: (shipment.status === 'DELIVERED' || shipment.status === 'CANCELLED')
            ? []
            : [{ vueloId: '--', origen: shipment.origen, destino: shipment.destino, salidaMin: 0, llegadaMin: 0 }]
        })
        return
      }
      setSelectedShipmentRoute(null)
      setShipmentSearchError('No se encontro el envio o maleta en operacion diaria.')
    } catch (e) {
      setSelectedShipmentRoute(null)
      setShipmentSearchError('Error al buscar el envio o maleta.')
    }
  }

  const fallbackCurrentMinute = useMemo(() => getCurrentMinuteOfDay(now), [now])
  const currentMinute = serverCurrentMinute ?? fallbackCurrentMinute
  const operationDateKey = getLimaDateKey()
  const cancelledFlightTraces = useMemo(() => {
    return buildCancelledFlightTraces(
      flightCatalog,
      airports,
      cancelledDays,
      operationDateKey,
      false,
    )
  }, [airports, cancelledDays, flightCatalog, operationDateKey])

  const applySnapshot = useCallback((snapshot: DailyOperationSnapshot) => {
    console.debug('[DailyOperationPage] applySnapshot', snapshot)
    if (snapshot.segments) {
      setSegments(snapshot.segments)
    }

    if (typeof snapshot.currentMinute === 'number') {
      setServerCurrentMinute(snapshot.currentMinute)
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
      setSampleShipments(snapshot.envios.map((shipment) => shipment.codigoPedido))
      setShipmentQuantities(Object.fromEntries(
        snapshot.envios.map((shipment) => [shipment.codigoPedido, shipment.cantidad])
      ))
      setShipmentFlightIds(Object.fromEntries(
        snapshot.envios.map((shipment) => [shipment.codigoPedido, shipment.vueloIds ?? []])
      ))
      setShipmentClientIds(Object.fromEntries(
        snapshot.envios.map((shipment) => [shipment.codigoPedido, shipment.idCliente])
      ))
      setSelectedShipmentRoute((currentRoute) =>
        syncSelectedShipmentRoute(currentRoute, snapshot.envios)
      )
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
      const response = await authFetch(`${API_BASE}/api/operation/daily`)

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
    let cancelled = false

    listFlights(0, 1000, '')
      .then((result) => {
        if (!cancelled) {
          setFlightCatalog(result.content)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFlightCatalog([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Las trazas canceladas se resuelven a partir del flag `cancelado` y el catálogo ya cargado.

  useEffect(() => {
    const syncCancelledDays = () => {
      setCancelledDays(readCancelledFlightDays({ includeVirtual: false }))
    }

    syncCancelledDays()
    window.addEventListener('tasf:cancelled-flight-days-updated', syncCancelledDays)
    window.addEventListener('storage', syncCancelledDays)

    return () => {
      window.removeEventListener('tasf:cancelled-flight-days-updated', syncCancelledDays)
      window.removeEventListener('storage', syncCancelledDays)
    }
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

  useEffect(() => {
    if (!selectedShipmentRoute?.codigoPedido) {
      return
    }

    let cancelled = false

    const refreshSelectedShipmentStatus = async () => {
      const shipment = await fetchShipmentFromDb(selectedShipmentRoute.codigoPedido)
      if (cancelled || !shipment?.status) {
        return
      }

      setSelectedShipmentRoute((currentRoute) => {
        if (!currentRoute || currentRoute.codigoPedido !== shipment.codigoPedido) {
          return currentRoute
        }

        const shouldHideRoute =
          shipment.status === 'DELIVERED' || shipment.status === 'CANCELLED'
        const nextRoute = shouldHideRoute ? [] : currentRoute.ruta

        if (currentRoute.estado === shipment.status && nextRoute === currentRoute.ruta) {
          return currentRoute
        }

        return {
          ...currentRoute,
          estado: shipment.status ?? 'PENDING',
          ruta: nextRoute,
        }
      })
    }

    void refreshSelectedShipmentStatus()
    const intervalId = window.setInterval(() => {
      void refreshSelectedShipmentStatus()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [selectedShipmentRoute?.codigoPedido])

  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
      // ✅ Si ya hay conexión abierta, no crear otra
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      const socketUrl = buildDailyOperationWsUrl()
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

  const mapAirports = useMemo(() => {
    return filterAirportsByMapFilters(airports, warehouseSnapshot, mapFilters, ranges)
  }, [airports, warehouseSnapshot, mapFilters, ranges])

  const mapSegments = useMemo(() => {
    const baseFiltered = filterFlightSegmentsByMapFilters(segments, mapFilters, ranges)
    const airportCodes = new Set(mapAirports.map(a => a.codigoOaci))
    return baseFiltered.filter(seg => airportCodes.has(seg.origen) || airportCodes.has(seg.destino))
  }, [segments, mapFilters, ranges, mapAirports])

  const visibleActiveSegments = useMemo(() => {
    return mapSegments.filter(
      (segment) => currentMinute >= segment.salidaMin && currentMinute <= segment.llegadaMin
    )
  }, [currentMinute, mapSegments])


  const mapFilterCounts = useMemo(() => ({
    flights: visibleActiveSegments.length,
    warehouses: mapAirports.length,
  }), [mapAirports.length, visibleActiveSegments.length])

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
  
    let totalWarehouseOcupacion = 0
    let totalWarehouseCapacidad = 0
    Object.values(warehouseSnapshot).forEach((w) => {
      totalWarehouseOcupacion += w.ocupacion
      totalWarehouseCapacidad += w.capacidad
    })
    const warehouseCapacityPct = totalWarehouseCapacidad > 0 ? (totalWarehouseOcupacion * 100) / totalWarehouseCapacidad : 0

    return {
      cards: [
        { label: 'Vuelos activos', value: formatInteger(totalActive) },
        { label: 'Vuelos planificados', value: formatInteger(totalFlights) },
        { label: 'Maletas en aire', value: formatBags(totalCargo) },
        {
          label: 'Capacidad usada almacenes',
          value: formatPercent(warehouseCapacityPct),
          color: resolveSemaphoreColor(warehouseCapacityPct, ranges).fill,
          borderColor: resolveSemaphoreColor(warehouseCapacityPct, ranges).stroke,
          textColor: '#ffffff',
          labelColor: (() => {
            const l = resolveSemaphoreLevel(warehouseCapacityPct, ranges);
            return l === 'green' ? '#0f5223' : l === 'amber' ? '#734b00' : l === 'red' ? '#66140c' : '#5f6f8e';
          })(),
        },
        {
          label: 'Capacidad usada vuelos',
          value: formatPercent(capacityPct),
          color: resolveSemaphoreColor(capacityPct, ranges).fill,
          borderColor: resolveSemaphoreColor(capacityPct, ranges).stroke,
          textColor: '#ffffff',
          labelColor: (() => {
            const l = resolveSemaphoreLevel(capacityPct, ranges);
            return l === 'green' ? '#0f5223' : l === 'amber' ? '#734b00' : l === 'red' ? '#66140c' : '#5f6f8e';
          })(),
        },
      ],
      bars: [
        { label: 'Actividad de vuelos', value: activePct },
        { label: 'Capacidad usada', value: capacityPct },
        { label: 'Avance de envíos', value: shipmentProgressPct },
      ],
    }
  }, [segments, activeSegments, shipmentSummary, ranges, warehouseSnapshot])

  const activeFlightItems = useMemo(() => {
    return visibleActiveSegments.map((segment) => ({
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
  }, [currentMinute, ranges, visibleActiveSegments])
  
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
    const airportFlightTimings = buildAirportFlightTimings(segments, currentMinute)

    return airports.map((airport) => ({
      codigoOaci: airport.codigoOaci,
      nombre: airport.nombre,
      pais: airport.pais,
      continente: resolveAirportContinent(
        airport.continente,
        airport.latitud,
        airport.longitud,
      ),
      capacidad: warehouseSnapshot[airport.codigoOaci]?.capacidad ?? airport.capacidad,
      ocupacion: warehouseSnapshot[airport.codigoOaci]?.ocupacion,
      porcentaje: warehouseSnapshot[airport.codigoOaci]?.porcentaje,
      nextDepartureMin: airportFlightTimings[airport.codigoOaci]?.nextDepartureMin,
      nextArrivalMin: airportFlightTimings[airport.codigoOaci]?.nextArrivalMin,
      color: warehouseSnapshot[airport.codigoOaci]
        ? resolveSemaphoreColor(warehouseSnapshot[airport.codigoOaci].porcentaje, ranges).fill
        : undefined,
    }))
  }, [airports, currentMinute, ranges, segments, warehouseSnapshot])
  
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

    entityFocusRequestIdRef.current += 1
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'airport',
      id: codigoOaci,
      requestId: entityFocusRequestIdRef.current,
    })
  }, [])

  const handleMapAirportDetailRequest = useCallback((codigoOaci: string) => {
    handleMapAirportPreview(codigoOaci)
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

    entityFocusRequestIdRef.current += 1
    setIsPanelCollapsed(false)
    setEntityFocusRequest({
      type: 'flight',
      id: flightId,
      requestId: entityFocusRequestIdRef.current,
    })
  }, [])

  const handleMapFlightDetailRequest = useCallback((flightId: number) => {
    handleMapFlightPreview(flightId)
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
        className={`map-area ${isPanelCollapsed ? "panel-collapsed" : ""} ${isMapFullscreen ? "is-fullscreen" : ""}`}
        style={{ '--panel-width': `${panelWidth}px` } as React.CSSProperties}
      >
        <div className="map-placeholder">
          <MapView
            airports={mapAirports}
            segments={mapSegments}
            currentMinute={currentMinute}
            timeLabel={formatDateTime(now)}
            cancelledFlightTraces={cancelledFlightTraces}
            warehouseSnapshot={warehouseSnapshot}
            ranges={ranges}
            mapFilters={mapFilters}
            onMapFiltersChange={setMapFilters}
            selectedFlightId={selectedFlightId}
            selectedAirportCode={selectedAirportCode}
            selectedShipmentRoute={selectedShipmentRoute}
            shipmentSearchError={shipmentSearchError}
            isFullscreen={isMapFullscreen}
            isPanelCollapsed={isPanelCollapsed}
            onToggleFullscreen={() => setIsMapFullscreen((current) => !current)}
            onSearchShipment={handleSearchShipment}
            onClearShipmentRoute={() => {
              setSelectedShipmentRoute(null)
              setShipmentSearchError(null)
            }}
            onAirportPreview={handleMapAirportPreview}
            onAirportDetailRequest={handleMapAirportDetailRequest}
            onFlightPreview={handleMapFlightPreview}
            onFlightDetailRequest={handleMapFlightDetailRequest}
            showCancelledDetails={showCancelledDetails}
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
          onSelectShipmentRoute={setSelectedShipmentRoute}
          shipmentSearchError={shipmentSearchError}
          sampleShipments={sampleShipments}
          shipmentQuantities={shipmentQuantities}
          shipmentFlightIds={shipmentFlightIds}
          shipmentClientIds={shipmentClientIds}
          flightTextFilters={mapFilters.flights.text}
          onFlightTextFiltersChange={(filters) =>
            setMapFilters((current) => ({
              ...current,
              flights: {
                ...current.flights,
                text: filters,
              },
            }))
          }
          airportTextFilters={mapFilters.warehouses.text}
          onAirportTextFiltersChange={(filters) =>
            setMapFilters((current) => ({
              ...current,
              warehouses: {
                ...current.warehouses,
                text: filters,
              },
            }))
          }
          currentMinute={currentMinute}
          alerts={alerts}
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
          onResizeStart={handleResizeStart}
          entityFocusRequest={entityFocusRequest}
          showCancelledDetails={showCancelledDetails}
          onShowCancelledDetailsChange={setShowCancelledDetails}
        />
      </section>
    </div>
  );
}
