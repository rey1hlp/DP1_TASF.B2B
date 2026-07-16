import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { AirportDto, FlightSegmentDto } from '../types/sim'

type MapRef = {
  current: L.Map | null
}

type ShipmentRoute = {
  codigoPedido?: string
  codigoMaleta?: string
  consultaMaleta?: boolean
  ruta: Array<{
    origen: string
    destino: string
    salidaMin: number
    llegadaMin: number
    vueloId?: number | string
  }>
} | null | undefined

export type UseMapSelectionFocusParams = {
  mapRef: MapRef
  airports: AirportDto[]
  segments: FlightSegmentDto[]
  currentMinute: number | null
  selectedFlightId: number | null
  selectedAirportCode: string | null
  selectedShipmentRoute?: ShipmentRoute
  defaultCenter: L.LatLngExpression
  defaultZoom: number
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

function getAirportPosition(
  airports: AirportDto[],
  airportCode: string,
): [number, number] | null {
  const airport = airports.find((item) => item.codigoOaci === airportCode)
  return airport ? [airport.latitud, airport.longitud] : null
}

function getShipmentCurrentPosition(
  route: NonNullable<ShipmentRoute>,
  airports: AirportDto[],
  segments: FlightSegmentDto[],
  currentMinute: number | null,
): L.LatLngExpression | null {
  if (!route.ruta.length) {
    return null
  }

  if (currentMinute === null) {
    const firstStep = route.ruta[0]
    return getAirportPosition(airports, firstStep.origen)
  }

  const firstStep = route.ruta[0]
  if (currentMinute < firstStep.salidaMin) {
    return getAirportPosition(airports, firstStep.origen)
  }

  const activeStep = route.ruta.find(
    (step) => currentMinute >= step.salidaMin && currentMinute <= step.llegadaMin,
  )

  if (activeStep) {
    const matchingSegment = segments.find(
      (segment) => String(segment.flightId) === String(activeStep.vueloId),
    )
    if (matchingSegment) {
      return getSegmentPosition(matchingSegment, currentMinute)
    }

    const origin = getAirportPosition(airports, activeStep.origen)
    const destination = getAirportPosition(airports, activeStep.destino)
    if (!origin || !destination) {
      return origin ?? destination
    }

    const total = Math.max(1, activeStep.llegadaMin - activeStep.salidaMin)
    const progress = Math.min(1, Math.max(0, (currentMinute - activeStep.salidaMin) / total))
    return [
      origin[0] + (destination[0] - origin[0]) * progress,
      origin[1] + (destination[1] - origin[1]) * progress,
    ]
  }

  const lastFinishedStep = [...route.ruta]
    .reverse()
    .find((step) => currentMinute > step.llegadaMin)

  if (lastFinishedStep) {
    return getAirportPosition(airports, lastFinishedStep.destino)
  }

  return getAirportPosition(airports, firstStep.origen)
}

export default function useMapSelectionFocus({
  mapRef,
  airports,
  segments,
  currentMinute,
  selectedFlightId,
  selectedAirportCode,
  selectedShipmentRoute,
  defaultCenter,
  defaultZoom,
}: UseMapSelectionFocusParams) {
  const lastFocusKeyRef = useRef<string | null>(null)

  const focusKey = useMemo(() => {
    if (selectedShipmentRoute?.ruta.length) {
      const routeKey = selectedShipmentRoute.ruta
        .map((step) => `${step.vueloId ?? ''}:${step.origen}-${step.destino}`)
        .join('|')
      const shipmentKey =
        selectedShipmentRoute.codigoMaleta ??
        selectedShipmentRoute.codigoPedido ??
        routeKey
      return `shipment:${shipmentKey}:${routeKey}`
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
      const hadFocus = lastFocusKeyRef.current !== null
      lastFocusKeyRef.current = null

      if (hadFocus && map) {
        map.flyTo(defaultCenter, defaultZoom, { duration: 0.6 })
      }
      return
    }
    if (!map) {
      return
    }

    if (lastFocusKeyRef.current === focusKey) {
      return
    }

    if (selectedShipmentRoute?.ruta.length) {
      if (selectedShipmentRoute.consultaMaleta || selectedShipmentRoute.codigoMaleta) {
        const currentPosition = getShipmentCurrentPosition(
          selectedShipmentRoute,
          airports,
          segments,
          currentMinute,
        )

        if (currentPosition) {
          map.flyTo(currentPosition, Math.max(map.getZoom(), 5), {
            duration: 0.6,
          })
          lastFocusKeyRef.current = focusKey
        }
        return
      }

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
    defaultCenter,
    defaultZoom,
  ])
}
