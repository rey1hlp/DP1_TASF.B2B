import type { AirportDto, FlightSegmentDto } from '../types/sim'
import type { MapSemaphoreFilters, SemaphoreFilterLevel } from '../types/mapFilters'
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

export function isFlightVisibleByMapFilters(
  segment: FlightSegmentDto,
  filters: MapSemaphoreFilters,
  ranges: SemaphoreRanges
) {
  const level = getSemaphoreLevel(getFlightOccupancyPercent(segment), ranges)
  return matchesSemaphoreFilter(level, filters.flights.semaphore)
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
