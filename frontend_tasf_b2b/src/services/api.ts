import type {
  AirportDto,
  AirportCrudDto,
  FlightCrudDto,
  PageResponse,
  ShipmentCrudDto,
  SimulationRequest,
  SimulationResponse,
} from '../types/sim'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export async function fetchAirports(): Promise<AirportDto[]> {
  const res = await fetch(`${API_BASE}/api/airports`)
  if (!res.ok) {
    throw new Error('No se pudo cargar aeropuertos')
  }
  return res.json()
}

export async function startSimulation(
  payload: SimulationRequest
): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}/api/simulations/ga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo iniciar la simulacion')
  }
  return res.json()
}

export function buildWsUrl(simId: string): string {
  const base = API_BASE.replace(/^http/, 'ws')
  return `${base}/ws/sim?simId=${encodeURIComponent(simId)}`
}

export async function uploadEnvios(files: File[]): Promise<{ enviosKey: string }> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  const res = await fetch(`${API_BASE}/api/uploads/envios`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error('No se pudo cargar archivos')
  }
  return res.json()
}

export async function deleteEnvios(enviosKey: string): Promise<void> {
  const params = new URLSearchParams({ key: enviosKey })
  const res = await fetch(`${API_BASE}/api/uploads/envios?${params.toString()}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error('No se pudo eliminar archivos de envios')
  }
}

export async function listAirports(page = 0, size = 20, query = ''): Promise<PageResponse<AirportCrudDto>> {
  const params = new URLSearchParams({ page: `${page}`, size: `${size}` })
  if (query) {
    params.set('query', query)
  }
  const res = await fetch(`${API_BASE}/api/db/airports?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo cargar aeropuertos (DB)')
  }
  return res.json()
}

export async function createAirport(payload: AirportCrudDto): Promise<AirportCrudDto> {
  const res = await fetch(`${API_BASE}/api/db/airports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo crear aeropuerto')
  }
  return res.json()
}

export async function updateAirport(id: number, payload: AirportCrudDto): Promise<AirportCrudDto> {
  const res = await fetch(`${API_BASE}/api/db/airports/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo actualizar aeropuerto')
  }
  return res.json()
}

export async function deleteAirport(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/db/airports/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar aeropuerto')
  }
}

export async function listFlights(page = 0, size = 20, query = ''): Promise<PageResponse<FlightCrudDto>> {
  const params = new URLSearchParams({ page: `${page}`, size: `${size}` })
  if (query) {
    params.set('query', query)
  }
  const res = await fetch(`${API_BASE}/api/db/flights?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo cargar vuelos')
  }
  return res.json()
}

export async function createFlight(payload: FlightCrudDto): Promise<FlightCrudDto> {
  const res = await fetch(`${API_BASE}/api/db/flights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo crear vuelo')
  }
  return res.json()
}

export async function updateFlight(id: number, payload: FlightCrudDto): Promise<FlightCrudDto> {
  const res = await fetch(`${API_BASE}/api/db/flights/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo actualizar vuelo')
  }
  return res.json()
}

export async function deleteFlight(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/db/flights/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar vuelo')
  }
}

export async function listShipments(page = 0, size = 20, query = ''): Promise<PageResponse<ShipmentCrudDto>> {
  const params = new URLSearchParams({ page: `${page}`, size: `${size}` })
  if (query) {
    params.set('query', query)
  }
  const res = await fetch(`${API_BASE}/api/db/shipments?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo cargar envios')
  }
  return res.json()
}

export async function createShipment(payload: ShipmentCrudDto): Promise<ShipmentCrudDto> {
  const res = await fetch(`${API_BASE}/api/db/shipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo crear envio')
  }
  return res.json()
}

export async function updateShipment(id: number, payload: ShipmentCrudDto): Promise<ShipmentCrudDto> {
  const res = await fetch(`${API_BASE}/api/db/shipments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error('No se pudo actualizar envio')
  }
  return res.json()
}

export async function deleteShipment(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/db/shipments/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar envio')
  }
}

export type BulkImportResult = {
  total: number
  inserted: number
  updated: number
  skipped: number
  invalidFormatLines: string[]
  invalidAirportLines: string[]
}

export async function uploadAirportsCsv(file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/db/airports/import-csv`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error('No se pudo cargar aeropuertos desde CSV')
  }
  return res.json()
}

export async function uploadFlightsTxt(file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/db/flights/import-txt`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error('No se pudo cargar vuelos desde TXT')
  }
  return res.json()
}

export async function cancelFlightDay(id: number, fecha: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/db/flights/${id}/day-cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flightId: id, fecha }),
  })
  if (res.status === 409) {
    throw new Error('Este vuelo ya está cancelado para ese día')
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error('Vuelo no encontrado')
    throw new Error('No se pudo cancelar el vuelo')
  }
}

export async function removeCancelFlightDay(id: number, fecha: string): Promise<void> {
  const params = new URLSearchParams({ fecha })
  const res = await fetch(`${API_BASE}/api/db/flights/${id}/day-cancel?${params.toString()}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Vuelo no encontrado o no estaba cancelado')
    throw new Error('No se pudo reactivar el vuelo')
  }
}

export async function getCancelledDays(id: number): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/db/flights/${id}/day-cancels`)
  if (!res.ok) {
    throw new Error('No se pudieron cargar los días cancelados')
  }
  return res.json()
}
