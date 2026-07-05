export type SemaphoreFilterLevel = 'all' | 'green' | 'amber' | 'red' | 'unknown'

export type FlightTextFilters = {
  codeQuery: string
  originQuery: string
  destinationQuery: string
}

export type AirportTextFilters = {
  codeQuery: string
  continentQuery: string
}

export type MapSemaphoreFilters = {
  flights: {
    semaphore: SemaphoreFilterLevel
    text: FlightTextFilters
  }
  warehouses: {
    semaphore: SemaphoreFilterLevel
    text: AirportTextFilters
  }
}

export const DEFAULT_FLIGHT_TEXT_FILTERS: FlightTextFilters = {
  codeQuery: '',
  originQuery: '',
  destinationQuery: '',
}

export const DEFAULT_AIRPORT_TEXT_FILTERS: AirportTextFilters = {
  codeQuery: '',
  continentQuery: '',
}

export const DEFAULT_MAP_SEMAPHORE_FILTERS: MapSemaphoreFilters = {
  flights: {
    semaphore: 'all',
    text: DEFAULT_FLIGHT_TEXT_FILTERS,
  },
  warehouses: {
    semaphore: 'all',
    text: DEFAULT_AIRPORT_TEXT_FILTERS,
  },
}
