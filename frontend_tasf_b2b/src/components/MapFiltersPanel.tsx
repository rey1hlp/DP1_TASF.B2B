import type { MapSemaphoreFilters, SemaphoreFilterLevel } from '../types/mapFilters'
import { formatInteger } from '../utils/time'

type MapFiltersPanelProps = {
  filters: MapSemaphoreFilters
  onChange: (filters: MapSemaphoreFilters) => void
  visibleCounts?: {
    flights: number
    warehouses: number
  }
}

const SEMAPHORE_OPTIONS: Array<{ value: SemaphoreFilterLevel; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'green', label: 'Verde' },
  { value: 'amber', label: 'Ámbar' },
  { value: 'red', label: 'Rojo' },
  { value: 'unknown', label: 'Sin datos' },
]

export default function MapFiltersPanel({
  filters,
  onChange,
  visibleCounts,
}: MapFiltersPanelProps) {
  const handleFlightSemaphoreChange = (value: SemaphoreFilterLevel) => {
    onChange({
      ...filters,
      flights: {
        ...filters.flights,
        semaphore: value,
      },
    })
  }

  const handleWarehouseSemaphoreChange = (value: SemaphoreFilterLevel) => {
    onChange({
      ...filters,
      warehouses: {
        ...filters.warehouses,
        semaphore: value,
      },
    })
  }

  return (
    <div className="field">
      <div className="field-label">Filtros del mapa</div>
      <div className="map-filter-grid">
        <label className="field">
          Vuelos
          <select
            value={filters.flights.semaphore}
            onChange={(event) =>
              handleFlightSemaphoreChange(event.target.value as SemaphoreFilterLevel)
            }
          >
            {SEMAPHORE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Almacenes
          <select
            value={filters.warehouses.semaphore}
            onChange={(event) =>
              handleWarehouseSemaphoreChange(event.target.value as SemaphoreFilterLevel)
            }
          >
            {SEMAPHORE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleCounts ? (
        <div className="flight-hint">
          {`${formatInteger(visibleCounts.flights)} vuelos · ${formatInteger(visibleCounts.warehouses)} almacenes`}
        </div>
      ) : null}
    </div>
  )
}
