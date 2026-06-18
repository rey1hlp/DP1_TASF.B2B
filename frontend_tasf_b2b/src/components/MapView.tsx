import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { AirportDto, FlightSegmentDto } from '../types/sim'
const PLANE_PATH =
  "M 17.8 19.2 L 16 11 l 3.5 -3.5 C 21 6 21.5 4 21 3 c -1 -0.5 -3 0 -4.5 1.5 L 13 8 L 4.8 6.2 c -0.5 -0.1 -0.9 0.1 -1.1 0.5 l -0.3 0.5 c -0.2 0.5 -0.1 1 0.3 1.3 L 9 12 l -2 3 H 4 l -1 1 l 3 2 l 2 3 l 1 -1 v -3 l 3 -2 l 3.5 5.3 c 0.3 0.4 0.8 0.5 1.3 0.3 l 0.5 -0.2 c 0.4 -0.3 0.6 -0.7 0.5 -1.2 Z"

const AIRPORT_PATH = "M2 21h20M3 7l9-4 9 4v14H3V7zm6 14v-7h6v7"

const NEUTRAL_COLORS = { stroke: '#b8923f', fill: '#e8c97a' }

export type MapViewProps = {
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
  warehouseSnapshot: Record<string, { capacidad: number; ocupacion: number; porcentaje: number; libre: number }>
  ranges: { greenMax: number; amberMax: number }
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute?: { ruta: Array<{ origen: string; destino: string; vueloId?: number }> } | null
}

const DEFAULT_CENTER: [number, number] = [12, -10]
const DEFAULT_ZOOM = 2

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
) {
  const rotation = heading - 45

  const percent =
    capacidad !== undefined && capacidad > 0
      ? (carga / capacidad) * 100
      : null

  const colors =
    percent === null
      ? NEUTRAL_COLORS
      : resolveSemaphoreColor(percent, ranges)

  const isEmpty = carga === 0
  const fill = isEmpty ? 'none' : colors.fill
  const stroke = colors.stroke
  const strokeWidth = isEmpty ? 1.8 : 1.5

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="${PLANE_PATH}"/>
  </svg>`

  return L.divIcon({
    className: 'plane-marker',
    html: `<div style="transform:rotate(${rotation}deg);width:28px;height:28px;opacity:${dimmed ? 0.4 : 1}">${svg}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function buildAirportIcon(
  colors: { stroke: string; fill: string },
  isSelected: boolean
) {
  const size = isSelected ? 34 : 26;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="${AIRPORT_PATH}"/>
  </svg>`;

  return L.divIcon({
    className: 'airport-marker',
    html: `<div style="width:${size}px;height:${size}px;">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function resolveSemaphoreColor(percent: number, ranges: { greenMax: number; amberMax: number }) {
  if (percent <= ranges.greenMax) {
    return { stroke: '#2f8f46', fill: '#54b86c' }
  }
  if (percent <= ranges.amberMax) {
    return { stroke: '#d3952a', fill: '#f0be62' }
  }
  return { stroke: '#c4473d', fill: '#e36b60' }
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
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const airportLayerRef = useRef<L.LayerGroup | null>(null)
  const planeLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (mapRef.current) {
      return
    }

    const map = L.map('map', {
      zoomControl: false,
      worldCopyJump: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    airportLayerRef.current = L.layerGroup().addTo(map)
    planeLayerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map
  }, [])

  // Notifica a Leaflet que el contenedor cambió de tamaño para evitar que el mapa se vea gris
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 300);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!airportLayerRef.current) {
      return
    }
    airportLayerRef.current.clearLayers()

    airports.forEach((airport) => {
      const snapshot = warehouseSnapshot[airport.codigoOaci]
      const percent = snapshot ? snapshot.porcentaje : null
      const colors = percent === null
        ? { stroke: '#d9a441', fill: '#f7d48a' }
        : resolveSemaphoreColor(percent, ranges)
      const isSelected = selectedAirportCode !== null && airport.codigoOaci === selectedAirportCode

      const icon = buildAirportIcon(colors, isSelected)
      const marker = L.marker([airport.latitud, airport.longitud], {
        icon
      })
      const tooltipParts = [
        `${airport.codigoOaci} - ${airport.nombre}`,
        `Capacidad: ${airport.capacidad}`,
      ]
      if (snapshot) {
        tooltipParts.push(`Ocupacion: ${snapshot.ocupacion}`)
        tooltipParts.push(`Libre: ${snapshot.libre}`)
        tooltipParts.push(`Uso: ${snapshot.porcentaje.toFixed(1)}%`)
      }
      const tooltip = tooltipParts.join('<br/>')
      marker.bindTooltip(tooltip, {
        direction: 'top',
        permanent: isSelected,
        opacity: 0.95,
      })
      if (isSelected) {
        marker.setZIndexOffset(1000)
        marker.openTooltip()
      }
      marker.addTo(airportLayerRef.current as L.LayerGroup)
    })
  }, [airports, warehouseSnapshot, ranges, selectedAirportCode])

  useEffect(() => {
    if (!planeLayerRef.current) {
      return
    }

    planeLayerRef.current.clearLayers()
    if (currentMinute === null) {
      return
    }

    const activeSegments = segments.filter(
      (seg) => currentMinute >= seg.salidaMin && currentMinute <= seg.llegadaMin
    )

    activeSegments.forEach((seg) => {
      const total = Math.max(1, seg.llegadaMin - seg.salidaMin)
      const progress = Math.min(1, Math.max(0, (currentMinute - seg.salidaMin) / total))
      const lat = seg.origenLat + (seg.destinoLat - seg.origenLat) * progress
      const lon = seg.origenLon + (seg.destinoLon - seg.origenLon) * progress
      const heading = computeBearing(seg.origenLat, seg.origenLon, seg.destinoLat, seg.destinoLon)
      const capacity = seg.capacidad
      const free = capacity !== undefined ? Math.max(0, capacity - seg.carga) : undefined

      const isSelectedFlight = selectedFlightId !== null && seg.flightId === selectedFlightId
      const isSelectedShipment = selectedShipmentRoute != null && selectedShipmentRoute.ruta.some(p => p.vueloId === seg.flightId)
      
      const isSelected = isSelectedFlight || isSelectedShipment
      const anySelectionActive = selectedFlightId !== null || selectedShipmentRoute != null
      const isDimmed = anySelectionActive && !isSelected

      const icon = buildPlaneIcon(heading, seg.carga, seg.capacidad, ranges, isDimmed)

      const tooltipParts = [
        `${seg.origen} → ${seg.destino}`,
        `Vuelo: ${seg.flightId}`,
        `Carga: ${Math.round(seg.carga)}`,
        capacity !== undefined ? `Capacidad: ${capacity}` : 'Capacidad: n/d',
        free !== undefined ? `Libre: ${free}` : 'Libre: n/d',
      ]
      const tooltip = `${tooltipParts.join('<br/>')}`

      const marker = L.marker([lat, lon], { icon })
      marker.bindTooltip(tooltip, {
        direction: 'top',
        permanent: isSelected,
        opacity: 0.95,
      })
      if (isSelected) {
        marker.setZIndexOffset(500)
        marker.openTooltip()
      }
      marker.addTo(planeLayerRef.current as L.LayerGroup)
    })
  }, [segments, currentMinute, selectedFlightId])

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
        const polyline = L.polyline(latlngs, {
          color: '#0dcaf0',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.8
        }).addTo(routeLayerRef.current)

        if (mapRef.current) {
          mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] })
        }
      }
    }
  }, [selectedShipmentRoute, airports])

  return (
    <div className={`map-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <button
        className="map-fullscreen-btn"
        onClick={() => setIsFullscreen(!isFullscreen)}
        title={isFullscreen ? "Salir" : "Expandir"}
      >
        {isFullscreen ? '✕' : '⛶'}
      </button>
      <div id="map" className="map"></div>
    </div>
  )
}
