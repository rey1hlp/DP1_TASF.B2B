import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { AirportDto, FlightSegmentDto } from '../types/sim'

export type MapViewProps = {
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
}

const DEFAULT_CENTER: [number, number] = [12, -10]
const DEFAULT_ZOOM = 2

function buildPlaneIcon() {
  return L.divIcon({
    className: 'plane-marker',
    html: '<div class="plane-icon">&#9992;</div>',
    iconSize: [26, 26],
  })
}

export default function MapView({ airports, segments, currentMinute }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null)
  const airportLayerRef = useRef<L.LayerGroup | null>(null)
  const planeLayerRef = useRef<L.LayerGroup | null>(null)

  const planeIcon = useMemo(() => buildPlaneIcon(), [])

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
      marker.bindTooltip(`${airport.codigoOaci} - ${airport.nombre}`, {
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

      const marker = L.marker([lat, lon], { icon: planeIcon })
      marker.bindTooltip(
        `${seg.origen} → ${seg.destino} | carga: ${Math.round(seg.carga)}`,
        { direction: 'top' }
      )
      marker.addTo(planeLayerRef.current as L.LayerGroup)
    })
  }, [segments, currentMinute, planeIcon])

  return <div id="map" className="map"></div>
}
