import type {
  AirportDto,
  AirportCrudDto,
  FlightCrudDto,
  PageResponse,
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

export async function deleteAllFlights(resetIds = false): Promise<void> {
  const params = new URLSearchParams()
  if (resetIds) {
    params.set('resetIds', 'true')
  }
  const url = `${API_BASE}/api/db/flights${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar todos los vuelos')
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
