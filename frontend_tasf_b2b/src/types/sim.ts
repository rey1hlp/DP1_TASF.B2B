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
