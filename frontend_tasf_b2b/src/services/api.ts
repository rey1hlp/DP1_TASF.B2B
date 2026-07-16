import type { FlightOccupancyData } from '../components/reports/FlightOccupancyReport';
import type {
  AirportDto,
  AirportCrudDto,
  FlightCrudDto,
  PageResponse,
  ShipmentCrudDto,
  SimulationReportImpact,
  SimulationReportRoute,
  SimulationReportRouteDetail,
  SimulationReportSummary,
  SimulationRequest,
  SimulationResponse,
  SimulationVirtualCancellation,
} from '../types/sim'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'
const AUTH_TOKEN_KEY = 'tasf.auth.token'

export type AuthRole = 'ADMIN' | 'LOGISTICS' | 'REGISTER'

export type AuthUser = {
  id: number
  email: string
  fullName: string
  role: AuthRole
  airportId?: number | null
  airportCode?: string | null
}

export type AppUserCrudDto = {
  id?: number
  email: string
  password?: string
  fullName: string
  role: AuthRole
  airportId?: number | null
  airportCode?: string | null
  airportName?: string | null
  enabled: boolean
  lastLoginAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type LoginResponse = {
  accessToken: string
  tokenType: 'Bearer'
  expiresInSeconds: number
  user: AuthUser
}

export function getAuthToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAuthToken()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  if (response.status === 401) {
    window.dispatchEvent(new Event('tasf:auth:unauthorized'))
  }

  return response
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error('Credenciales invalidas')
  }
  return res.json()
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await authFetch(`${API_BASE}/api/auth/me`)
  if (!res.ok) {
    throw new Error('No se pudo cargar la sesion')
  }
  return res.json()
}

function appendAccessToken(url: string): string {
  const token = getAuthToken()
  if (!token) return url

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}access_token=${encodeURIComponent(token)}`
}

// Obtener un aeropuerto por su código OACI
export async function getAirportByCode(code: string): Promise<AirportCrudDto> {
  const res = await authFetch(`${API_BASE}/api/db/airports/${encodeURIComponent(code)}`);
  if (!res.ok) {
    throw new Error('Aeropuerto no encontrado');
  }
  return res.json();
}

// Envíos físicos en bodega de un aeropuerto
export async function getWarehouseShipments(airportCode: string): Promise<ShipmentCrudDto[]> {
  const res = await authFetch(`${API_BASE}/api/db/airports/${encodeURIComponent(airportCode)}/warehouse-shipments`);
  if (!res.ok) {
    throw new Error('Error al obtener envíos de bodega');
  }
  return res.json();
}

export async function getAirportShipments(
  airportCode: string,
  opts?: { simId?: string | null; minute?: number | null }
): Promise<ShipmentCrudDto[]> {
  const minuteQuery = opts?.minute !== undefined && opts?.minute !== null
    ? `?minute=${encodeURIComponent(String(opts.minute))}`
    : ''

  if (opts?.simId) {
    const res = await authFetch(
      `${API_BASE}/api/simulations/${encodeURIComponent(opts.simId)}/airports/${encodeURIComponent(airportCode)}/shipments${minuteQuery}`
    )
    if (!res.ok) {
      throw new Error('Error al obtener envíos del aeropuerto en simulación')
    }
    return res.json()
  }

  const res = await authFetch(
    `${API_BASE}/api/db/airports/${encodeURIComponent(airportCode)}/shipments${minuteQuery}`
  )
  if (!res.ok) {
    throw new Error('Error al obtener envíos del aeropuerto')
  }
  return res.json()
}

// Vuelo por ID
export async function getFlightById(id: number): Promise<FlightCrudDto> {
  const res = await authFetch(`${API_BASE}/api/db/flights/${id}`);
  if (!res.ok) {
    throw new Error('Vuelo no encontrado');
  }
  return res.json();
}

// Manifiesto de envíos asignados a un vuelo
export async function getShipmentsByFlight(flightId: number): Promise<ShipmentCrudDto[]> {
  const res = await authFetch(`${API_BASE}/api/db/flights/${flightId}/shipments`);
  if (!res.ok) {
    throw new Error('Error al obtener envíos del vuelo');
  }
  return res.json();
}

export async function fetchAirports(): Promise<AirportDto[]> {
  const res = await authFetch(`${API_BASE}/api/airports`)
  if (!res.ok) {
    throw new Error('No se pudo cargar aeropuertos')
  }
  return res.json()
}

export async function listUsers(): Promise<AppUserCrudDto[]> {
  const res = await authFetch(`${API_BASE}/api/admin/users`)
  if (!res.ok) {
    throw new Error('No se pudo cargar empleados')
  }
  return res.json()
}

export async function createUser(payload: AppUserCrudDto): Promise<AppUserCrudDto> {
  const res = await authFetch(`${API_BASE}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(message || 'No se pudo crear empleado')
  }
  return res.json()
}

export async function updateUser(id: number, payload: AppUserCrudDto): Promise<AppUserCrudDto> {
  const res = await authFetch(`${API_BASE}/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(message || 'No se pudo actualizar empleado')
  }
  return res.json()
}

export async function deleteUser(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/admin/users/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(message || 'No se pudo eliminar empleado')
  }
}

export async function startSimulation(
  payload: SimulationRequest
): Promise<SimulationResponse> {
  const res = await authFetch(`${API_BASE}/api/simulations/ga`, {
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
  return appendAccessToken(`${base}/ws/sim?simId=${encodeURIComponent(simId)}`)
}

export function buildDailyOperationWsUrl(): string {
  const base = API_BASE.replace(/^http/, 'ws')
  return appendAccessToken(`${base}/api/operation/daily/stream`)
}

export async function uploadEnvios(files: File[]): Promise<{ enviosKey: string }> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  const res = await authFetch(`${API_BASE}/api/uploads/envios`, {
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
  const res = await authFetch(`${API_BASE}/api/uploads/envios?${params.toString()}`, {
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
  const res = await authFetch(`${API_BASE}/api/db/airports?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo cargar aeropuertos (DB)')
  }
  return res.json()
}

export async function createAirport(payload: AirportCrudDto): Promise<AirportCrudDto> {
  const res = await authFetch(`${API_BASE}/api/db/airports`, {
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
  const res = await authFetch(`${API_BASE}/api/db/airports/${id}`, {
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
  const res = await authFetch(`${API_BASE}/api/db/airports/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar aeropuerto')
  }
}

export async function listFlights(page = 0, size = 20, query = ''): Promise<PageResponse<FlightCrudDto>> {
  const params = new URLSearchParams({ page: `${page}`, size: `${size}` })
  if (query) {
    params.set('query', query)
  }
  const res = await authFetch(`${API_BASE}/api/db/flights?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo cargar vuelos')
  }
  return res.json()
}

export async function createFlight(payload: FlightCrudDto): Promise<FlightCrudDto> {
  const res = await authFetch(`${API_BASE}/api/db/flights`, {
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
  const res = await authFetch(`${API_BASE}/api/db/flights/${id}`, {
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
  const res = await authFetch(`${API_BASE}/api/db/flights/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar vuelo')
  }
}

export async function listShipments(page = 0, size = 20, query = ''): Promise<PageResponse<ShipmentCrudDto>> {
  const params = new URLSearchParams({ page: `${page}`, size: `${size}` })
  if (query) {
    params.set('query', query)
  }
  const res = await authFetch(`${API_BASE}/api/db/shipments?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo cargar envios')
  }
  return res.json()
}

export async function createShipment(payload: ShipmentCrudDto): Promise<ShipmentCrudDto> {
  const res = await authFetch(`${API_BASE}/api/db/shipments`, {
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
  const res = await authFetch(`${API_BASE}/api/db/shipments/${id}`, {
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
  const res = await authFetch(`${API_BASE}/api/db/shipments/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('No se pudo eliminar envio')
  }
}

export async function uploadShipmentsTxt(file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await authFetch(`${API_BASE}/api/db/shipments/import-txt`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error('No se pudo cargar envios desde TXT')
  }
  return res.json()
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
  const res = await authFetch(`${API_BASE}/api/db/airports/import-csv`, {
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
  const res = await authFetch(`${API_BASE}/api/db/flights/import-txt`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    throw new Error('No se pudo cargar vuelos desde TXT')
  }
  return res.json()
}

export type FlightDayCancelContext = {
  contextDate?: string | null
  contextMinuteOfDay?: number | null
}

export async function cancelFlightDay(id: number, fecha: string, context?: FlightDayCancelContext): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/db/flights/${id}/day-cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flightId: id,
      fecha,
      contextDate: context?.contextDate ?? null,
      contextMinuteOfDay: context?.contextMinuteOfDay ?? null,
    }),
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
  const res = await authFetch(`${API_BASE}/api/db/flights/${id}/day-cancel?${params.toString()}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Vuelo no encontrado o no estaba cancelado')
    throw new Error('No se pudo reactivar el vuelo')
  }
}

export async function getCancelledDays(id: number): Promise<string[]> {
  const res = await authFetch(`${API_BASE}/api/db/flights/${id}/day-cancels`)
  if (!res.ok) {
    throw new Error('No se pudieron cargar los días cancelados')
  }
  return res.json()
}

// Reporte de ocupación histórica por vuelo
export async function fetchOccupancyReport(date?: string): Promise<FlightOccupancyData[]> {
  const params = new URLSearchParams();

  if (date) {
    // 🌟 AGREGA ESTA LÍNEA: Convierte "2026-07-02" en "20260702" para que coincida con tu BD
    const cleanDate = date.replace(/-/g, '');
    params.set('date', cleanDate);
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await authFetch(`${API_BASE}/api/reports/occupancy${queryString}`);

  if (!res.ok) {
    throw new Error('Error al obtener el reporte de ocupación');
  }
  return res.json();
}

export async function getSimulationShipmentsByFlight(
  simId: string,
  flightId: number,
  opts?: { planId?: number; salidaMin?: number }
): Promise<ShipmentCrudDto[]> {
  const params = new URLSearchParams()
  if (opts?.planId !== undefined && opts.planId !== null) params.set('planId', String(opts.planId))
  if (opts?.salidaMin !== undefined && opts.salidaMin !== null) params.set('salidaMin', String(opts.salidaMin))
  const query = params.toString()
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/flights/${flightId}/shipments${query ? `?${query}` : ''}`
  );
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('No se encontró el vuelo o la simulación.');
    }
    throw new Error('No se pudo obtener el manifiesto de envíos de la simulación.');
  }
  return res.json();
}

export async function getSimulationShipmentCodes(simId: string): Promise<string[]> {
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments/all`
  )
  if (!res.ok) {
    throw new Error('No se pudo obtener el listado completo de envíos de la simulación')
  }
  return res.json()
}

export async function createSimulationVirtualCancellation(
  simId: string,
  flightId: number,
  payload: Pick<SimulationVirtualCancellation, 'fecha' | 'contextDate' | 'contextMinuteOfDay' | 'reason'>
): Promise<SimulationVirtualCancellation> {
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/flights/${flightId}/virtual-cancel`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flightId,
        fecha: payload.fecha,
        contextDate: payload.contextDate ?? null,
        contextMinuteOfDay: payload.contextMinuteOfDay ?? null,
        reason: payload.reason ?? null,
      }),
    }
  )
  if (res.status === 409) {
    throw new Error('Este vuelo ya está cancelado virtualmente para ese día')
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error('Simulación o vuelo no encontrado')
    throw new Error('No se pudo cancelar el vuelo en la simulación')
  }
  return res.json()
}

export async function removeSimulationVirtualCancellation(
  simId: string,
  flightId: number,
  fecha: string
): Promise<void> {
  const params = new URLSearchParams({ fecha })
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/flights/${flightId}/virtual-cancel?${params.toString()}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    if (res.status === 404) throw new Error('Cancelación virtual no encontrada')
    throw new Error('No se pudo retirar la cancelación virtual')
  }
}

export async function listSimulationVirtualCancellations(simId: string): Promise<SimulationVirtualCancellation[]> {
  const res = await authFetch(`${API_BASE}/api/simulations/${encodeURIComponent(simId)}/virtual-cancellations`)
  if (!res.ok) {
    throw new Error('No se pudieron cargar las cancelaciones virtuales')
  }
  return res.json()
}

export async function getShipmentByCode(code: string): Promise<ShipmentCrudDto | null> {
  const params = new URLSearchParams({ page: '0', size: '1', query: code })
  const res = await authFetch(`${API_BASE}/api/db/shipments?${params.toString()}`)
  if (!res.ok) {
    return null
  }
  const data = await res.json()
  const content = Array.isArray(data?.content) ? data.content : []
  return content.find((shipment: ShipmentCrudDto) => shipment.codigoPedido === code) ?? null
}

//NUEVAS FUNCIONES PARA CUBRIR LOS DETALLES DE VUELOS
export interface EnvioDetalleDto {
  codigoPedido: string;
  origen: string;
  destino: string;
  ut: string;
  cantidadMaletas: number;
  idCliente?: string | null;
  estado: 'PLANIFICADO' | 'EN_VUELO' | 'ENTREGADO';
  minutoEntrega?: number | null;
  vueloIds?: string[];
}

export interface SimulationShipmentsResponseDto {
  planificados: EnvioDetalleDto[];
  enVuelo: EnvioDetalleDto[];
  entregadosRecientes: EnvioDetalleDto[];
}

export async function fetchCategorizedShipments(
  simId: string,
  currentMinute: number
): Promise<SimulationShipmentsResponseDto> {
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/shipments/categorized?currentMinute=${currentMinute}`
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('No se encontró el estado de la simulación.');
    }
    throw new Error('Error al obtener los envíos categorizados.');
  }

  return res.json();
}

export async function fetchSimulationReportSummary(simId: string): Promise<SimulationReportSummary> {
  const res = await authFetch(`${API_BASE}/api/simulations/${encodeURIComponent(simId)}/report`)
  if (!res.ok) {
    throw new Error('No se pudo obtener el reporte de simulación')
  }
  return res.json()
}

export async function fetchSimulationReportRoutes(
  simId: string,
  opts: { page?: number; size?: number; estado?: string; query?: string; impactedOnly?: boolean } = {}
): Promise<PageResponse<SimulationReportRoute>> {
  const params = new URLSearchParams({
    page: String(opts.page ?? 0),
    size: String(opts.size ?? 10),
    impactedOnly: String(Boolean(opts.impactedOnly)),
  })
  if (opts.estado) params.set('estado', opts.estado)
  if (opts.query) params.set('query', opts.query)
  const res = await authFetch(`${API_BASE}/api/simulations/${encodeURIComponent(simId)}/report/routes?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudieron obtener las rutas del reporte')
  }
  return res.json()
}

export async function fetchSimulationReportRouteDetail(
  simId: string,
  codigoPedido: string
): Promise<SimulationReportRouteDetail> {
  const res = await authFetch(
    `${API_BASE}/api/simulations/${encodeURIComponent(simId)}/report/routes/${encodeURIComponent(codigoPedido)}`
  )
  if (!res.ok) {
    throw new Error('No se pudo obtener el detalle de la ruta')
  }
  return res.json()
}

export async function fetchSimulationReportImpacts(
  simId: string,
  opts: { page?: number; size?: number; type?: string } = {}
): Promise<PageResponse<SimulationReportImpact>> {
  const params = new URLSearchParams({
    page: String(opts.page ?? 0),
    size: String(opts.size ?? 10),
  })
  if (opts.type) params.set('type', opts.type)
  const res = await authFetch(`${API_BASE}/api/simulations/${encodeURIComponent(simId)}/report/impacts?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudieron obtener las rutas impactadas')
  }
  return res.json()
}

export async function downloadSimulationReportCsv(simId: string, section = 'all'): Promise<Blob> {
  const params = new URLSearchParams({ section })
  const res = await authFetch(`${API_BASE}/api/simulations/${encodeURIComponent(simId)}/report/export.csv?${params.toString()}`)
  if (!res.ok) {
    throw new Error('No se pudo exportar el reporte CSV')
  }
  return res.blob()
}

export async function downloadSimulationReportPdf(simId: string): Promise<Blob> {
  const res = await authFetch(`${API_BASE}/api/simulations/${encodeURIComponent(simId)}/report/export.pdf`)
  if (!res.ok) {
    throw new Error('No se pudo exportar el reporte PDF')
  }
  return res.blob()
}

export interface OperationAlertDto {
  id: string;
  // El backend genera dinámicamente estas severidades a partir del snapshot
  // de almacenes (DailyOperationService.buildWarehouseSnapshot): 80% -> WARNING, 95% -> DANGER.
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'DANGER';
  message: string;
  createdAt: string;
}

export async function fetchOperationAlerts(date?: string): Promise<OperationAlertDto[]> {
  const params = new URLSearchParams();
  if (date) {
    // Si tu backend espera YYYY-MM-DD, lo pasamos tal cual.
    params.set('date', date);
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await authFetch(`${API_BASE}/api/operation/alerts${queryString}`);

  if (!res.ok) {
    throw new Error('Error al obtener alertas de colapso operativo');
  }
  return res.json();
}
