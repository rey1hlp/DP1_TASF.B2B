export type SemaphoreFilterLevel = 'all' | 'green' | 'amber' | 'red' | 'unknown'

export type MapSemaphoreFilters = {
  flights: {
    semaphore: SemaphoreFilterLevel
  }
  warehouses: {
    semaphore: SemaphoreFilterLevel
  }
}

export const DEFAULT_MAP_SEMAPHORE_FILTERS: MapSemaphoreFilters = {
  flights: {
    semaphore: 'all',
  },
  warehouses: {
    semaphore: 'all',
  },
}
