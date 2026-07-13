export interface EnvioDetalleDto {
  codigoPedido: string;
  origen: string;
  destino: string;
  ut: string;
  cantidadMaletas: number;
  estado: 'PLANIFICADO' | 'EN_VUELO' | 'ENTREGADO';
  minutoEntrega?: number | null;
}

export interface SimulationShipmentsResponseDto {
  planificados: EnvioDetalleDto[];
  enVuelo: EnvioDetalleDto[];
  entregadosRecientes: EnvioDetalleDto[];
}

export type AirportDto = {
  codigoOaci: string
  nombre: string
  pais: string
  continente?: string
  capacidad: number
  gmt: number
  latitud: number
  longitud: number
}

export type SimulationRequest = {
  envios?: string
  inicio?: string
  fin?: string
  dias?: number
  maxEnvios?: number
  poblacion?: number
  generaciones?: number
  cruce?: number
  mutacion?: number
  torneo?: number
  hilos?: number
  paralelo?: boolean
  estancamiento?: number
  maxTiempoMs?: number
  buscarColapso?: boolean
  colapsoIncremental?: boolean
  reporte?: boolean
  diasExtra?: number
  bloqueDias?: number
  intervaloPlanMs?: number
  speedMinPerSec?: number
}

export type SimulationResponse = {
  simulationId: string
  status: string
  inicio?: string
  fin?: string
  envios?: number
  maletas?: number
  diasExtra?: number
  speedMinPerSec?: number
  message?: string
}

export type FlightSegmentDto = {
  flightId: number
  planId: number
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
  carga: number
  capacidad?: number
  origenLat: number
  origenLon: number
  destinoLat: number
  destinoLon: number
}

export type WarehouseEventDto = {
  minuto: number
  delta: number
}

export type WarehouseStatusDto = {
  codigoOaci: string
  capacidad: number
  eventos: WarehouseEventDto[]
}

export type WsInitMessage = {
  type: 'init'
  simulationId: string
  inicio: string
  fin: string
  diaMin: number
  diaMax: number
  diasExtra: number
  totalEnvios: number
  totalMaletas: number
  speedMinPerSec: number
  vuelos: FlightSegmentDto[]
  almacenes: WarehouseStatusDto[]
}

export type WsAppendMessage = {
  type: 'append'
  simulationId: string
  inicio: string
  fin: string
  diaMin: number
  diaMax: number
  diasExtra: number
  totalEnvios: number
  totalMaletas: number
  speedMinPerSec: number
  vuelos: FlightSegmentDto[]
  almacenes: WarehouseStatusDto[]
  message?: string | null
}

export type WsTickMessage = {
  type: 'tick'
  simulationId: string
  minuto: number
}

export type WsStatusMessage = {
  type: 'status'
  simulationId: string
  status: string
  message?: string | null
}

export type WsMessage = WsInitMessage | WsAppendMessage | WsTickMessage | WsStatusMessage

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type SimulationReportMetric = {
  key: string
  label: string
  value?: number | null
  text?: string | null
}

export type SimulationReportCancellation = {
  id: number
  flightId: number
  fechaCancelacion: string
  sourceType?: 'REAL' | 'VIRTUAL' | string
  contextMinute?: number | null
  reason?: string | null
  flightCodigo?: string | null
  origen?: string | null
  destino?: string | null
  salida?: string | null
  llegada?: string | null
}

export type SimulationVirtualCancellation = {
  id?: number
  simulationId?: string
  flightId: number
  fecha?: string | null
  contextDate?: string | null
  contextMinuteOfDay?: number | null
  contextMinute?: number | null
  reason?: string | null
  fechaCancelacion?: string | null
  createdAt?: string | null
  flightCodigo?: string | null
  origen?: string | null
  destino?: string | null
}

export type SimulationReportSummary = {
  snapshotId: number
  simulationId: string
  versionNumber: number
  inicio?: string | null
  fin?: string | null
  diaMin?: number | null
  diaMax?: number | null
  diasExtra?: number | null
  totalEnvios: number
  totalMaletas: number
  speedMinPerSec?: number | null
  createdAt: string
  metrics: SimulationReportMetric[]
  routeStatusCounts: Record<string, number>
  impactTypeCounts: Record<string, number>
  impactedRoutes: number
  cancellations: SimulationReportCancellation[]
}

export type SimulationReportRoute = {
  id: number
  codigoPedido: string
  estado: string
  tiempoTotalHoras: number
  ingresoMin: number
  totalMaletas?: number | null
  origen?: string | null
  destino?: string | null
  stepsCount: number
  impacted: boolean
}

export type SimulationReportRouteStep = {
  stepIndex: number
  vueloId: number
  planId?: number | null
  origen: string
  destino: string
  salidaMin: number
  llegadaMin: number
  salidaAlmacenDestinoMin: number
}

export type SimulationReportRouteDetail = SimulationReportRoute & {
  steps: SimulationReportRouteStep[]
}

export type SimulationReportImpact = {
  id: number
  codigoPedido: string
  impactType: 'REASSIGNED' | 'WITHOUT_ROUTE' | 'CANCELLED_SEGMENT_REMOVED' | string
  previousEstado?: string | null
  currentEstado?: string | null
  detail?: string | null
  flightId?: number | null
  fechaCancelacion?: string | null
}

export type AirportCrudDto = {
  id?: number
  codigoOaci: string
  nombre: string
  pais: string
  ciudad?: string
  continente?: string
  gmt: number
  capacidad: number
  latitud: number
  longitud: number
}

export type FlightCrudDto = {
  id?: number
  codigo: string
  origenOaci: string
  origenCiudad?: string
  destinoOaci: string
  destinoCiudad?: string
  salida: string
  llegada: string
  capacidad: number
  cancelado: boolean
}

export type ShipmentCrudDto = {
  id?: number
  codigoPedido: string
  origen: string
  origenCiudad?: string
  destino: string
  destinoCiudad?: string
  fecha: string
  diaIndex: number
  ingresoUtc: string
  ingresoLocal: string
  gmtOffset: number
  cantidad: number
  idCliente: string
  slaHoras: number
  status?: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'
  asignado: boolean
  auditDateIns?: string
}
