import type { AirportDto, FlightSegmentDto } from '../types/sim'
import type { FlightTextFilters, MapSemaphoreFilters, SemaphoreFilterLevel } from '../types/mapFilters'
import { resolveSemaphoreLevel, type SemaphoreRanges } from './semaphore'

type WarehouseSnapshot = Record<
  string,
  { capacidad: number; ocupacion: number; porcentaje: number; libre: number }
>

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
  airportCode: string,
  warehouseSnapshot: WarehouseSnapshot,
  filters: MapSemaphoreFilters,
  ranges: SemaphoreRanges
) {
  const level = getSemaphoreLevel(warehouseSnapshot[airportCode]?.porcentaje, ranges)
  return matchesSemaphoreFilter(level, filters.warehouses.semaphore)
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
    isAirportVisibleByMapFilters(airport.codigoOaci, warehouseSnapshot, filters, ranges)
  )
}
