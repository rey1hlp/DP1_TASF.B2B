import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { AirportDto, FlightSegmentDto } from '../types/sim'
import planeUrl from '../assets/plane.png'

export type MapViewProps = {
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
  warehouseSnapshot: Record<string, { capacidad: number; ocupacion: number; porcentaje: number; libre: number }>
  ranges: { greenMax: number; amberMax: number }
  selectedFlightId: number | null
  selectedAirportCode: string | null
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

function buildPlaneIcon(heading: number) {
  const rotation = heading - 45
  return L.divIcon({
    className: 'plane-marker',
    html: `<img class="plane-icon" src="${planeUrl}" style="transform: rotate(${rotation}deg)" />`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
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
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null)
  const airportLayerRef = useRef<L.LayerGroup | null>(null)
  const planeLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (mapRef.current) {
      return
    }

    const map = L.map('map', {
      zoomControl: false,
      worldCopyJump: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data © OpenStreetMap contributors',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    airportLayerRef.current = L.layerGroup().addTo(map)
    planeLayerRef.current = L.layerGroup().addTo(map)

    mapRef.current = map
  }, [])

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

      const marker = L.circleMarker([airport.latitud, airport.longitud], {
        radius: isSelected ? 9 : 8,
        color: colors.stroke,
        weight: isSelected ? 2.5 : 2,
        fillColor: colors.fill,
        fillOpacity: 0.9,
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
        marker.bringToFront()
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
      const icon = buildPlaneIcon(heading)
      const capacity = seg.capacidad
      const free = capacity !== undefined ? Math.max(0, capacity - seg.carga) : undefined
      const isSelected = selectedFlightId !== null && seg.flightId === selectedFlightId
      const isDimmed = selectedFlightId !== null && !isSelected

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
      if (isDimmed) {
        marker.setOpacity(0.4)
      } else {
        marker.setOpacity(1)
      }
      if (isSelected) {
        marker.setZIndexOffset(500)
        marker.openTooltip()
      }
      marker.addTo(planeLayerRef.current as L.LayerGroup)
    })
  }, [segments, currentMinute, selectedFlightId])

  return <div id="map" className="map"></div>
}
