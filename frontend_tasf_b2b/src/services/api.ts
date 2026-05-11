import type {
  AirportDto,
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
