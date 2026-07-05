import type { AirportDto, FlightSegmentDto } from '../types/sim'
import type {
  AirportTextFilters,
  FlightTextFilters,
  MapSemaphoreFilters,
  SemaphoreFilterLevel,
} from '../types/mapFilters'
import { resolveAirportContinent } from './continents'
import { resolveSemaphoreLevel, type SemaphoreRanges } from './semaphore'

type WarehouseSnapshot = Record<
  string,
  { capacidad: number; ocupacion: number; porcentaje: number; libre: number }
>

type FlightTimingSource = {
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
}

export function buildAirportFlightTimings<T extends FlightTimingSource>(
  segments: T[],
  currentMinute: number | null,
) {
  const timings: Record<
    string,
    { nextDepartureMin?: number; nextArrivalMin?: number }
  > = {}

  if (currentMinute === null) {
    return timings
  }

  segments.forEach((segment) => {
    const originCode = segment.origen.toUpperCase()
    const destinationCode = segment.destino.toUpperCase()

    if (segment.salidaMin >= currentMinute) {
      const current = timings[originCode]?.nextDepartureMin
      if (current === undefined || segment.salidaMin < current) {
        timings[originCode] = {
          ...timings[originCode],
          nextDepartureMin: segment.salidaMin,
        }
      }
    }

    if (segment.llegadaMin >= currentMinute) {
      const current = timings[destinationCode]?.nextArrivalMin
      if (current === undefined || segment.llegadaMin < current) {
        timings[destinationCode] = {
          ...timings[destinationCode],
          nextArrivalMin: segment.llegadaMin,
        }
      }
    }
  })

  return timings
}

export function getSemaphoreLevel(
  percent: number | null | undefined,
  ranges: SemaphoreRanges
): Exclude<SemaphoreFilterLevel, 'all'> {
  return resolveSemaphoreLevel(percent, ranges)
}

export function matchesSemaphoreFilter(
  level: Exclude<SemaphoreFilterLevel, 'all'>,
  filter: SemaphoreFilterLevel
) {
  return filter === 'all' || level === filter
}

export function getFlightOccupancyPercent(segment: FlightSegmentDto) {
  if (segment.capacidad === undefined || segment.capacidad <= 0) {
    return null
  }

  return (segment.carga * 100) / segment.capacidad
}

type FlightFilterTarget = {
  flightId: number | string
  origen: string
  destino: string
}

type AirportFilterTarget = {
  codigoOaci: string
  continente?: string
  latitud?: number
  longitud?: number
}

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase()
}

export function matchesFlightTextFilters(
  flight: FlightFilterTarget,
  filters: FlightTextFilters,
) {
  const codeQuery = normalizeFilterValue(filters.codeQuery)
  const originQuery = normalizeFilterValue(filters.originQuery)
  const destinationQuery = normalizeFilterValue(filters.destinationQuery)

  if (codeQuery && !String(flight.flightId).toLowerCase().includes(codeQuery)) {
    return false
  }

  if (originQuery && !flight.origen.toLowerCase().includes(originQuery)) {
    return false
  }

  if (destinationQuery && !flight.destino.toLowerCase().includes(destinationQuery)) {
    return false
  }

  return true
}

export function filterFlightsByTextFilters<T extends FlightFilterTarget>(
  flights: T[],
  filters: FlightTextFilters,
) {
  return flights.filter((flight) => matchesFlightTextFilters(flight, filters))
}

export function matchesAirportTextFilters(
  airport: AirportFilterTarget,
  filters: AirportTextFilters,
) {
  const codeQuery = normalizeFilterValue(filters.codeQuery)
  const continentQuery = normalizeFilterValue(filters.continentQuery)
  const resolvedContinent = normalizeFilterValue(
    resolveAirportContinent(airport.continente, airport.latitud, airport.longitud),
  )

  if (codeQuery && !airport.codigoOaci.toLowerCase().includes(codeQuery)) {
    return false
  }

  if (continentQuery && resolvedContinent !== continentQuery) {
    return false
  }

  return true
}

export function isFlightVisibleByMapFilters(
  segment: FlightSegmentDto,
  filters: MapSemaphoreFilters,
  ranges: SemaphoreRanges
) {
  const level = getSemaphoreLevel(getFlightOccupancyPercent(segment), ranges)
  return (
    matchesSemaphoreFilter(level, filters.flights.semaphore) &&
    matchesFlightTextFilters(segment, filters.flights.text)
  )
}

export function isAirportVisibleByMapFilters(
  airport: AirportDto,
  warehouseSnapshot: WarehouseSnapshot,
  filters: MapSemaphoreFilters,
  ranges: SemaphoreRanges
) {
  const level = getSemaphoreLevel(warehouseSnapshot[airport.codigoOaci]?.porcentaje, ranges)
  return (
    matchesSemaphoreFilter(level, filters.warehouses.semaphore) &&
    matchesAirportTextFilters(airport, filters.warehouses.text)
  )
}

export function filterFlightSegmentsByMapFilters(
  segments: FlightSegmentDto[],
  filters: MapSemaphoreFilters,
  ranges: SemaphoreRanges
) {
  return segments.filter((segment) => isFlightVisibleByMapFilters(segment, filters, ranges))
}

export function filterAirportsByMapFilters(
  airports: AirportDto[],
  warehouseSnapshot: WarehouseSnapshot,
  filters: MapSemaphoreFilters,
  ranges: SemaphoreRanges
) {
  return airports.filter((airport) =>
    isAirportVisibleByMapFilters(airport, warehouseSnapshot, filters, ranges)
  )
}
