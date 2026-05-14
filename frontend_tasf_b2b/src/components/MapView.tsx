import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { AirportDto, FlightSegmentDto } from '../types/sim'
import planeUrl from '../assets/plane.png'

export type MapViewProps = {
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
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

export default function MapView({ airports, segments, currentMinute }: MapViewProps) {
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
      const marker = L.circleMarker([airport.latitud, airport.longitud], {
        radius: 4,
        color: '#f4c56a',
        weight: 1,
        fillColor: '#f7d48a',
        fillOpacity: 0.9,
      })
      const tooltip = `${airport.codigoOaci} - ${airport.nombre}<br/>Capacidad: ${airport.capacidad}`
      marker.bindTooltip(tooltip, {
        direction: 'top',
      })
      marker.addTo(airportLayerRef.current as L.LayerGroup)
    })
  }, [airports])

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

      const tooltipParts = [
        `${seg.origen} → ${seg.destino}`,
        `Carga: ${Math.round(seg.carga)}`,
        capacity !== undefined ? `Capacidad: ${capacity}` : 'Capacidad: n/d',
        free !== undefined ? `Libre: ${free}` : 'Libre: n/d',
      ]
      const tooltip = `${tooltipParts.join('<br/>')}`

      const marker = L.marker([lat, lon], { icon })
      marker.bindTooltip(tooltip, { direction: 'top' })
      marker.addTo(planeLayerRef.current as L.LayerGroup)
    })
  }, [segments, currentMinute])

  return <div id="map" className="map"></div>
}
