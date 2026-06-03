export type AirportDto = {
  codigoOaci: string
  nombre: string
  pais: string
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
  reporte?: boolean
  diasExtra?: number
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

export type WsMessage = WsInitMessage | WsTickMessage | WsStatusMessage

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
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
  destino: string
  fecha: string
  diaIndex: number
  ingresoUtc: string
  ingresoLocal: string
  gmtOffset: number
  cantidad: number
  idCliente: string
  slaHoras: number
  asignado: boolean
  auditDateIns?: string
}
