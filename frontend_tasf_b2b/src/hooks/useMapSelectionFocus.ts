import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { AirportDto, FlightSegmentDto } from '../types/sim'

type MapRef = {
  current: L.Map | null
}

type ShipmentRoute = {
  ruta: Array<{ origen: string; destino: string; vueloId?: number | string }>
} | null | undefined

export type UseMapSelectionFocusParams = {
  mapRef: MapRef
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute?: ShipmentRoute
}

function getSegmentPosition(segment: FlightSegmentDto, minute: number | null): L.LatLngExpression {
  if (minute === null) {
    return [
      (segment.origenLat + segment.destinoLat) / 2,
      (segment.origenLon + segment.destinoLon) / 2,
    ]
  }

  const total = Math.max(1, segment.llegadaMin - segment.salidaMin)
  const progress = Math.min(1, Math.max(0, (minute - segment.salidaMin) / total))

  return [
    segment.origenLat + (segment.destinoLat - segment.origenLat) * progress,
    segment.origenLon + (segment.destinoLon - segment.origenLon) * progress,
  ]
}

export default function useMapSelectionFocus({
  mapRef,
  airports,
  segments,
  currentMinute,
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentRoute,
}: UseMapSelectionFocusParams) {
  const lastFocusKeyRef = useRef<string | null>(null)

  const focusKey = useMemo(() => {
    if (selectedShipmentRoute?.ruta.length) {
      const routeKey = selectedShipmentRoute.ruta
        .map((step) => `${step.vueloId ?? ''}:${step.origen}-${step.destino}`)
        .join('|')
      return `shipment:${routeKey}`
    }
    if (selectedFlightId !== null) {
      return `flight:${selectedFlightId}`
    }
    if (selectedAirportCode !== null) {
      return `airport:${selectedAirportCode}`
    }
    return null
  }, [selectedAirportCode, selectedFlightId, selectedShipmentRoute])

  useEffect(() => {
    const map = mapRef.current
    if (!focusKey) {
      lastFocusKeyRef.current = null
      return
    }
    if (!map) {
      return
    }

    if (lastFocusKeyRef.current === focusKey) {
      return
    }

    if (selectedShipmentRoute?.ruta.length) {
      const latlngs: L.LatLngExpression[] = []

      selectedShipmentRoute.ruta.forEach((step) => {
        const origin = airports.find((airport) => airport.codigoOaci === step.origen)
        if (origin) {
          latlngs.push([origin.latitud, origin.longitud])
        }
      })

      const lastStep = selectedShipmentRoute.ruta[selectedShipmentRoute.ruta.length - 1]
      const destination = airports.find((airport) => airport.codigoOaci === lastStep.destino)
      if (destination) {
        latlngs.push([destination.latitud, destination.longitud])
      }

      if (latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs), {
          animate: true,
          maxZoom: 5,
          padding: [56, 56],
        })
        lastFocusKeyRef.current = focusKey
      } else if (latlngs.length === 1) {
        map.flyTo(latlngs[0], Math.max(map.getZoom(), 5), { duration: 0.6 })
        lastFocusKeyRef.current = focusKey
      }
      return
    }

    if (selectedFlightId !== null) {
      const selectedSegment = segments.find((segment) => segment.flightId === selectedFlightId)
      if (!selectedSegment) {
        return
      }

      const latlngs: L.LatLngExpression[] = [
        [selectedSegment.origenLat, selectedSegment.origenLon],
        [selectedSegment.destinoLat, selectedSegment.destinoLon],
      ]
      const bounds = L.latLngBounds(latlngs)

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          animate: true,
          maxZoom: 5,
          padding: [56, 56],
        })
      } else {
        map.flyTo(getSegmentPosition(selectedSegment, currentMinute), Math.max(map.getZoom(), 5), {
          duration: 0.6,
        })
      }

      lastFocusKeyRef.current = focusKey
      return
    }

    if (selectedAirportCode !== null) {
      const selectedAirport = airports.find((airport) => airport.codigoOaci === selectedAirportCode)
      if (!selectedAirport) {
        return
      }

      map.flyTo([selectedAirport.latitud, selectedAirport.longitud], Math.max(map.getZoom(), 5), {
        duration: 0.6,
      })
      lastFocusKeyRef.current = focusKey
    }
  }, [
    airports,
    currentMinute,
    focusKey,
    mapRef,
    segments,
    selectedAirportCode,
    selectedFlightId,
    selectedShipmentRoute,
  ])
}
