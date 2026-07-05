import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk'
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import type { AirportDto, FlightSegmentDto } from '../types/sim'
import { formatBags, formatInteger, formatMinuteRange, formatPercent } from '../utils/time'
import {
  NEUTRAL_SEMAPHORE_COLORS,
  resolveSemaphoreColor,
  resolveSemaphoreLevel,
} from '../utils/semaphore'
import MapFloatingCard from './MapFloatingCard'
import useMapSelectionFocus from '../hooks/useMapSelectionFocus'
const PLANE_PATH =
  "M 17.8 19.2 L 16 11 l 3.5 -3.5 C 21 6 21.5 4 21 3 c -1 -0.5 -3 0 -4.5 1.5 L 13 8 L 4.8 6.2 c -0.5 -0.1 -0.9 0.1 -1.1 0.5 l -0.3 0.5 c -0.2 0.5 -0.1 1 0.3 1.3 L 9 12 l -2 3 H 4 l -1 1 l 3 2 l 2 3 l 1 -1 v -3 l 3 -2 l 3.5 5.3 c 0.3 0.4 0.8 0.5 1.3 0.3 l 0.5 -0.2 c 0.4 -0.3 0.6 -0.7 0.5 -1.2 Z"

const AIRPORT_PATH = "M2 21h20M3 7l9-4 9 4v14H3V7zm6 14v-7h6v7"

export type MapViewProps = {
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
  warehouseSnapshot: Record<string, { capacidad: number; ocupacion: number; porcentaje: number; libre: number }>
  ranges: { greenMax: number; amberMax: number }
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute?: { ruta: Array<{ origen: string; destino: string; vueloId?: number | string }> } | null
  isPanelCollapsed?: boolean
  isToolbarCollapsed?: boolean
  timeLabel?: string
  onAirportDetailRequest?: (codigoOaci: string) => void
  onAirportPreview?: (codigoOaci: string | null) => void
  onFlightDetailRequest?: (flightId: number) => void
  onFlightPreview?: (flightId: number | null) => void
}

const DEFAULT_CENTER: [number, number] = [12, -10]
const DEFAULT_ZOOM = 2
const YOUR_API_KEY = 'cs78LhJcqA5P4sFbhTaG';
const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/019f2fff-a937-7733-b3ff-b0ebc2406d84/style.json`
const MAP_PANES = {
  route: 'tasf-route-pane',
  airport: 'tasf-airport-pane',
  plane: 'tasf-plane-pane',
} as const
const SELECTED_ROUTE_STYLE = {
  color: '#0dcaf0',
  weight: 4,
  dashArray: '8, 8',
  opacity: 0.8,
  pane: MAP_PANES.route,
} satisfies L.PolylineOptions
const SELECTED_AIRPORT_COLORS = {
  stroke: '#2f62b5',
  fill: '#d7e5fb',
}

const LANDED_ROUTE_STYLE = {
  ...SELECTED_ROUTE_STYLE,
  color: '#9ca3af', // tailwind gray-400
  dashArray: '4, 6',
} satisfies L.PolylineOptions

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const delta = toRad(lon2 - lon1)
  const y = Math.sin(delta) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta)
  const bearing = Math.atan2(y, x)
  return (bearing * 180) / Math.PI
}

function buildPlaneIcon(
  heading: number,
  carga: number,
  capacidad: number | undefined,
  ranges: { greenMax: number; amberMax: number },
  dimmed = false,
  isSelected = false,
) {
  const rotation = heading - 45

  const percent =
    capacidad !== undefined && capacidad > 0
      ? (carga / capacidad) * 100
      : null

  const colors = isSelected
    ? SELECTED_AIRPORT_COLORS
    : percent === null
      ? NEUTRAL_SEMAPHORE_COLORS
      : resolveSemaphoreColor(percent, ranges)

  const isEmpty = carga === 0
  const fill = isEmpty && !isSelected ? 'none' : colors.fill
  const stroke = colors.stroke
  const strokeWidth = isSelected ? 2.1 : isEmpty ? 1.8 : 1.5

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="${PLANE_PATH}"/>
  </svg>`

  return L.divIcon({
    className: 'plane-marker',
    html: `<div class="plane-marker-hitbox"><div style="transform:rotate(${rotation}deg);width:28px;height:28px;opacity:${dimmed ? 0.4 : 1}">${svg}</div></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

function buildAirportIcon(
  colors: { stroke: string; fill: string },
  isSelected: boolean
) {
  const markerSize = isSelected ? 42 : 34
  const iconSize = isSelected ? 30 : 24
  const displayColors = isSelected ? SELECTED_AIRPORT_COLORS : colors

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
    fill="${displayColors.fill}" stroke="${displayColors.stroke}" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="${AIRPORT_PATH}"/>
  </svg>`

  return L.divIcon({
    className: 'airport-marker',
    html: `<div style="
      width:${markerSize}px;
      height:${markerSize}px;
      border-radius:999px;
      background:#ffffff;
      border:1px solid rgba(15, 23, 42, 0.18);
      display:grid;
      place-items:center;
      box-shadow:0 2px 7px rgba(15, 23, 42, 0.25);
    ">${svg}</div>`,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  })
}

function addSelectedRouteToLayer(latlngs: L.LatLngExpression[], layer: L.LayerGroup) {
  if (latlngs.length < 2) {
    return
  }

  L.polyline(latlngs, SELECTED_ROUTE_STYLE).addTo(layer)
}

export default function MapView({
  airports,
  segments,
  currentMinute,
  warehouseSnapshot,
  ranges,
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentRoute,
  isPanelCollapsed,
  isToolbarCollapsed,
  timeLabel,
  onAirportDetailRequest,
  onAirportPreview,
  onFlightDetailRequest,
  onFlightPreview,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [previewAirportCode, setPreviewAirportCode] = useState<string | null>(null)
  const [previewFlightId, setPreviewFlightId] = useState<number | null>(null)
  const airportLayerRef = useRef<L.LayerGroup | null>(null)
  const planeLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const planeMarkersRef = useRef<Map<number, L.Marker>>(new Map())
  const resizeFrameRef = useRef<number | null>(null)
  const resizeTimerRef = useRef<number | null>(null)
  const closedPreviewAirportCodeRef = useRef<string | null>(null)
  const closedPreviewFlightIdRef = useRef<number | null>(null)

  const previewAirport = useMemo(() => {
    if (previewAirportCode === null) {
      return null
    }
    return airports.find((airport) => airport.codigoOaci === previewAirportCode) ?? null
  }, [airports, previewAirportCode])

  const previewFlight = useMemo(() => {
    if (previewFlightId === null) {
      return null
    }
    return segments.find((segment) => segment.flightId === previewFlightId) ?? null
  }, [segments, previewFlightId])

  const invalidateMapSize = () => {
    if (!mapRef.current) {
      return
    }

    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current)
    }
    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current)
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ animate: false })
      resizeFrameRef.current = null
    })

    resizeTimerRef.current = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false })
      resizeTimerRef.current = null
    }, 350)
  }

  const handleResetView = () => {
    mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true })
  }

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      worldCopyJump: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    const routePane = map.createPane(MAP_PANES.route)
    const airportPane = map.createPane(MAP_PANES.airport)
    const planePane = map.createPane(MAP_PANES.plane)

    routePane.style.zIndex = '420'
    airportPane.style.zIndex = '520'
    planePane.style.zIndex = '620'

    new MaptilerLayer({
      apiKey: YOUR_API_KEY,
      style: MAPTILER_STYLE_URL,
    }).addTo(map)

    const zoomControl = L.control.zoom({ position: 'bottomright' }).addTo(map)
    window.setTimeout(() => {
      const container = zoomControl.getContainer()
      if (!container) {
        return
      }
      const zoomIn = container.querySelector('.leaflet-control-zoom-in') as HTMLAnchorElement | null
      const zoomOut = container.querySelector('.leaflet-control-zoom-out') as HTMLAnchorElement | null
      if (zoomIn) {
        zoomIn.title = 'Acercar'
        zoomIn.setAttribute('aria-label', 'Acercar')
      }
      if (zoomOut) {
        zoomOut.title = 'Alejar'
        zoomOut.setAttribute('aria-label', 'Alejar')
      }
    }, 0)

    airportLayerRef.current = L.layerGroup().addTo(map)
    planeLayerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const handleMapClick = () => {
      setPreviewAirportCode(null)
      setPreviewFlightId(null)
      onAirportPreview?.(null)
      onFlightPreview?.(null)
    }

    map.on('click', handleMapClick)

    return () => {
      map.off('click', handleMapClick)
    }
  }, [onAirportPreview, onFlightPreview])

  // Leaflet no detecta cambios de tamaño provocados por CSS grid/flex, como el colapso del sidebar.
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver(() => invalidateMapSize())
    observer.observe(container)
    invalidateMapSize()

    return () => {
      observer.disconnect()
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    invalidateMapSize()
  }, [isFullscreen, isPanelCollapsed, isToolbarCollapsed])

  useEffect(() => {
    if (previewAirportCode !== null && !airports.some((airport) => airport.codigoOaci === previewAirportCode)) {
      setPreviewAirportCode(null)
    }
  }, [airports, previewAirportCode])

  useEffect(() => {
    if (previewFlightId !== null && !segments.some((segment) => segment.flightId === previewFlightId)) {
      setPreviewFlightId(null)
    }
  }, [segments, previewFlightId])

  useEffect(() => {
    if (selectedAirportCode === null) {
      closedPreviewAirportCodeRef.current = null
      if (previewAirportCode !== null) {
        setPreviewAirportCode(null)
      }
      return
    }

    if (closedPreviewAirportCodeRef.current !== selectedAirportCode) {
      closedPreviewAirportCodeRef.current = null
    }

    if (
      selectedAirportCode !== previewAirportCode &&
      closedPreviewAirportCodeRef.current !== selectedAirportCode
    ) {
      setPreviewAirportCode(selectedAirportCode)
    }
  }, [previewAirportCode, selectedAirportCode])

  useEffect(() => {
    if (selectedFlightId === null) {
      closedPreviewFlightIdRef.current = null
      if (previewFlightId !== null) {
        setPreviewFlightId(null)
      }
      return
    }

    if (closedPreviewFlightIdRef.current !== selectedFlightId) {
      closedPreviewFlightIdRef.current = null
    }

    if (
      selectedFlightId !== previewFlightId &&
      closedPreviewFlightIdRef.current !== selectedFlightId
    ) {
      setPreviewFlightId(selectedFlightId)
    }
  }, [previewFlightId, selectedFlightId])

  useMapSelectionFocus({
    mapRef,
    airports,
    segments,
    currentMinute,
    selectedFlightId,
    selectedAirportCode,
    selectedShipmentRoute,
    defaultCenter: DEFAULT_CENTER,
    defaultZoom: DEFAULT_ZOOM,
  })

  useEffect(() => {
    if (!airportLayerRef.current) {
      return
    }
    airportLayerRef.current.clearLayers()

    airports.forEach((airport) => {
      const snapshot = warehouseSnapshot[airport.codigoOaci]
      const percent = snapshot ? snapshot.porcentaje : null
      const colors = percent === null
        ? NEUTRAL_SEMAPHORE_COLORS
        : resolveSemaphoreColor(percent, ranges)
      const isSelected = selectedAirportCode !== null && airport.codigoOaci === selectedAirportCode

      const icon = buildAirportIcon(colors, isSelected)
      const marker = L.marker([airport.latitud, airport.longitud], {
        icon,
        pane: MAP_PANES.airport,
      })
      const tooltipParts = [
        `${airport.codigoOaci} - ${airport.nombre}`,
      ]
      if (snapshot) {
        tooltipParts.push(`Uso: ${formatPercent(snapshot.porcentaje)}`)
        tooltipParts.push(`Ocupacion: ${formatInteger(snapshot.ocupacion)}/${formatInteger(snapshot.capacidad)}`)
      }
      const tooltip = tooltipParts.join('<br/>')
      marker.bindTooltip(tooltip, {
        direction: 'top',
        permanent: false,
        opacity: 0.95,
      })
      if (isSelected) {
        marker.setZIndexOffset(1000)
      }
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event.originalEvent)
        if (previewAirportCode === airport.codigoOaci) {
          closedPreviewAirportCodeRef.current = null
          setPreviewAirportCode(null)
          onAirportPreview?.(null)
          return
        }

        closedPreviewAirportCodeRef.current = null
        setPreviewAirportCode(airport.codigoOaci)
        onAirportPreview?.(airport.codigoOaci)
      })
      marker.addTo(airportLayerRef.current as L.LayerGroup)
    })
  }, [airports, warehouseSnapshot, ranges, selectedAirportCode, onAirportPreview, previewAirportCode])

  useEffect(() => {
    if (!planeLayerRef.current) {
      return
    }

    const layer = planeLayerRef.current
    const nextActiveIds = new Set<number>()

    if (currentMinute === null) {
      planeMarkersRef.current.forEach((marker) => {
        layer.removeLayer(marker)
      })
      planeMarkersRef.current.clear()
      return
    }

    const activeSegments = segments.filter(
      (seg) => currentMinute >= seg.salidaMin && currentMinute <= seg.llegadaMin
    )

    activeSegments.forEach((seg) => {
      nextActiveIds.add(seg.flightId)
      const total = Math.max(1, seg.llegadaMin - seg.salidaMin)
      const progress = Math.min(1, Math.max(0, (currentMinute - seg.salidaMin) / total))
      const lat = seg.origenLat + (seg.destinoLat - seg.origenLat) * progress
      const lon = seg.origenLon + (seg.destinoLon - seg.origenLon) * progress
      const heading = computeBearing(seg.origenLat, seg.origenLon, seg.destinoLat, seg.destinoLon)
      const capacity = seg.capacidad

      const isSelectedFlight = selectedFlightId !== null && seg.flightId === selectedFlightId
      const isSelectedShipment = selectedShipmentRoute != null && selectedShipmentRoute.ruta.some(p => p.vueloId === seg.flightId)

      const isSelected = isSelectedFlight || isSelectedShipment
      const anySelectionActive = selectedFlightId !== null || selectedShipmentRoute != null
      const isDimmed = anySelectionActive && !isSelected

      const icon = buildPlaneIcon(heading, seg.carga, seg.capacidad, ranges, isDimmed, isSelectedFlight)

      const tooltipParts = [
        `Vuelo ${seg.flightId}`,
        `${seg.origen} → ${seg.destino}`,
        capacity !== undefined
          ? `Maletas: ${formatBags(seg.carga)} / ${formatBags(capacity)}`
          : 'Capacidad: n/d',
      ]
      const tooltip = `${tooltipParts.join('<br/>')}`

      let marker = planeMarkersRef.current.get(seg.flightId)
      if (!marker) {
        marker = L.marker([lat, lon], {
          icon,
          pane: MAP_PANES.plane,
          bubblingMouseEvents: false,
        })
        marker.bindTooltip(tooltip, {
          direction: 'top',
          permanent: isSelectedShipment,
          opacity: 0.95,
        })
        marker.on('click', (event) => {
          L.DomEvent.stop(event.originalEvent)
          if (previewFlightId === seg.flightId) {
            closedPreviewFlightIdRef.current = null
            setPreviewFlightId(null)
            onFlightPreview?.(null)
            return
          }

          closedPreviewFlightIdRef.current = null
          setPreviewFlightId(seg.flightId)
          onFlightPreview?.(seg.flightId)
        })
        marker.addTo(layer)
        planeMarkersRef.current.set(seg.flightId, marker)
      } else {
        marker.setLatLng([lat, lon])
        marker.setIcon(icon)
        const tooltipInstance = marker.getTooltip()
        if (tooltipInstance) {
          tooltipInstance.setContent(tooltip)
          if (isSelectedShipment) {
            marker.openTooltip()
          } else if (!isSelectedShipment && tooltipInstance.isOpen()) {
            marker.closeTooltip()
          }
        }
      }

      marker.setZIndexOffset(isSelected ? 500 : 0)
    })

    planeMarkersRef.current.forEach((marker, flightId) => {
      if (!nextActiveIds.has(flightId)) {
        layer.removeLayer(marker)
        planeMarkersRef.current.delete(flightId)
      }
    })
  }, [segments, currentMinute, selectedFlightId, selectedShipmentRoute, ranges, onFlightPreview, previewFlightId])

  useEffect(() => {
    if (!routeLayerRef.current) {
      return
    }

    routeLayerRef.current.clearLayers()
    if (selectedShipmentRoute && selectedShipmentRoute.ruta && selectedShipmentRoute.ruta.length > 0) {
      const latlngs: L.LatLngExpression[] = []

      selectedShipmentRoute.ruta.forEach((paso) => {
        const orig = airports.find((a) => a.codigoOaci === paso.origen)
        if (orig) {
          latlngs.push([orig.latitud, orig.longitud])
        }
      })

      const ultPaso = selectedShipmentRoute.ruta[selectedShipmentRoute.ruta.length - 1]
      const dest = airports.find((a) => a.codigoOaci === ultPaso.destino)
      if (dest) {
        latlngs.push([dest.latitud, dest.longitud])
      }

      if (latlngs.length > 1) {
        addSelectedRouteToLayer(latlngs, routeLayerRef.current)
      }
      return
    }

    if (selectedFlightId !== null) {
      const selectedSegment = segments.find((segment) => segment.flightId === selectedFlightId)
      if (selectedSegment) {
        const minuteForRender = currentMinute
        const hasDeparted = minuteForRender !== null && minuteForRender >= selectedSegment.salidaMin
        const isLanded = minuteForRender !== null && minuteForRender >= selectedSegment.llegadaMin

        // Estilos: Definimos el estilo opaco copiando el original pero bajando la opacidad.
        // Opcional: le agregué un 'dashArray' para que se vea punteada la parte que ya pasó.
        const TRAVERSED_STYLE = { ...SELECTED_ROUTE_STYLE, opacity: 0.3, dashArray: '5, 5' }
        const REMAINING_STYLE = SELECTED_ROUTE_STYLE

        if (hasDeparted && !isLanded) {
          // 1. El avión está en el aire: calculamos su posición exacta
          const total = Math.max(1, selectedSegment.llegadaMin - selectedSegment.salidaMin)
          const progress = Math.min(1, Math.max(0, (minuteForRender - selectedSegment.salidaMin) / total))

          const currentLat = selectedSegment.origenLat + (selectedSegment.destinoLat - selectedSegment.origenLat) * progress
          const currentLon = selectedSegment.origenLon + (selectedSegment.destinoLon - selectedSegment.origenLon) * progress

          L.polyline(
            [[selectedSegment.origenLat, selectedSegment.origenLon], [currentLat, currentLon]],
            TRAVERSED_STYLE
          ).addTo(routeLayerRef.current)

          L.polyline(
            [[currentLat, currentLon], [selectedSegment.destinoLat, selectedSegment.destinoLon]],
            REMAINING_STYLE
          ).addTo(routeLayerRef.current)

        } else if (isLanded) {
          L.polyline(
            [[selectedSegment.origenLat, selectedSegment.origenLon], [selectedSegment.destinoLat, selectedSegment.destinoLon]],
            LANDED_ROUTE_STYLE
          ).addTo(routeLayerRef.current)
        } else {
          L.polyline(
            [[selectedSegment.origenLat, selectedSegment.origenLon], [selectedSegment.destinoLat, selectedSegment.destinoLon]],
            REMAINING_STYLE
          ).addTo(routeLayerRef.current)
        }
      }
    }
  }, [selectedFlightId, selectedShipmentRoute, airports, segments, currentMinute])

  return (
    <div ref={wrapperRef} className={`map-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <button
        className="map-fullscreen-btn"
        onClick={() => setIsFullscreen(!isFullscreen)}
        title={isFullscreen ? "Salir" : "Expandir"}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <button
        className="map-reset-view-btn"
        onClick={handleResetView}
        title="Restablecer vista"
        aria-label="Restablecer zoom y posición del mapa"
      >
        <RotateCcw size={17} />
      </button>
      {timeLabel ? <div className="map-time-tab">{timeLabel}</div> : null}
      {previewFlight ? (
        <MapFloatingCard
          actionLabel="Ver detalle completo"
          badge={`Vuelo ${previewFlight.flightId}`}
          metrics={[
            {
              label: 'Uso',
              value: formatPercent(getFlightLoadPercent(previewFlight), 1),
            },
            {
              label: 'Maletas',
              value: previewFlight.capacidad !== undefined
                ? `${formatBags(previewFlight.carga)}/${formatBags(previewFlight.capacidad)}`
                : `${formatBags(previewFlight.carga)}/--`,
            },
          ]}
          onAction={() => onFlightDetailRequest?.(previewFlight.flightId)}
          onClose={() => {
            closedPreviewFlightIdRef.current = previewFlight.flightId
            setPreviewFlightId(null)
          }}
          statusColor={resolveSemaphoreColor(
            getFlightLoadPercent(previewFlight),
            ranges
          ).fill}
          statusLabel={getSemaphoreLabel(
            getFlightLoadPercent(previewFlight),
            ranges
          )}
          subtitle={formatMinuteRange(previewFlight.salidaMin, previewFlight.llegadaMin)}
          title={`${previewFlight.origen} → ${previewFlight.destino}`}
        />
      ) : previewAirport ? (
        <MapFloatingCard
          actionLabel="Ver detalle completo"
          badge={previewAirport.codigoOaci}
          metrics={[
            {
              label: 'Uso',
              value: formatPercent(warehouseSnapshot[previewAirport.codigoOaci]?.porcentaje, 1),
            },
            {
              label: 'Ocupación',
              value: warehouseSnapshot[previewAirport.codigoOaci]
                ? `${formatInteger(warehouseSnapshot[previewAirport.codigoOaci].ocupacion)}/${formatInteger(warehouseSnapshot[previewAirport.codigoOaci].capacidad)}`
                : `0/${formatInteger(previewAirport.capacidad)}`,
            },
          ]}
          onAction={() => onAirportDetailRequest?.(previewAirport.codigoOaci)}
          onClose={() => {
            closedPreviewAirportCodeRef.current = previewAirport.codigoOaci
            setPreviewAirportCode(null)
          }}
          statusColor={resolveSemaphoreColor(
            warehouseSnapshot[previewAirport.codigoOaci]?.porcentaje,
            ranges
          ).fill}
          statusLabel={getSemaphoreLabel(
            warehouseSnapshot[previewAirport.codigoOaci]?.porcentaje,
            ranges
          )}
          subtitle={previewAirport.pais}
          title={previewAirport.nombre}
        />
      ) : null}
      <div ref={containerRef} className="map"></div>
    </div>
  )
}

function getFlightLoadPercent(segment: FlightSegmentDto) {
  if (segment.capacidad === undefined || segment.capacidad <= 0) {
    return undefined
  }
  return (segment.carga / segment.capacidad) * 100
}

function getSemaphoreLabel(
  percent: number | null | undefined,
  ranges: { greenMax: number; amberMax: number }
) {
  const level = resolveSemaphoreLevel(percent, ranges)
  if (level === 'green') {
    return `Semáforo: verde (0% - ${ranges.greenMax}%)`
  }
  if (level === 'amber') {
    return `Semáforo: ámbar (${ranges.greenMax + 1}% - ${ranges.amberMax}%)`
  }
  if (level === 'red') {
    return `Semáforo: rojo (${ranges.amberMax + 1}% - 100%)`
  }
  return 'Semáforo: sin datos'
}
