import type { AirportCrudDto, FlightCrudDto } from '../types/sim'
import { getDayIndexFromDateString } from './time'

export type CancelledFlightSource = 'REAL' | 'VIRTUAL'

export type CancelledFlightTrace = {
  flightId: number
  sourceType?: CancelledFlightSource
  origenLat: number
  origenLon: number
  destinoLat: number
  destinoLon: number
  salidaMin: number
  llegadaMin: number
}

export type CancelledFlightDay = {
  flightId: number
  fecha: string
  sourceType?: CancelledFlightSource
  simulationId?: string | null
  origen?: string
  destino?: string
  origenLat?: number
  origenLon?: number
  destinoLat?: number
  destinoLon?: number
  salidaMin?: number
  llegadaMin?: number
}

const REAL_STORAGE_KEY = 'tasf.cancelled_flight_days'
const SIMULATION_STORAGE_PREFIX = 'tasf.simulation_cancelled_flight_days:'

type ReadCancelledFlightDaysOptions = {
  simulationId?: string | null
  includeReal?: boolean
  includeVirtual?: boolean
}

function normalizeDateKey(value?: string | null) {
  if (!value) {
    return null
  }

  return value.slice(0, 10)
}

function getMinuteOfDay(value?: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.getHours() * 60 + parsed.getMinutes() + parsed.getSeconds() / 60
}

function simulationStorageKey(simulationId: string) {
  return `${SIMULATION_STORAGE_PREFIX}${simulationId}`
}

function normalizeCancelledItems(items: unknown, fallbackSource: CancelledFlightSource): CancelledFlightDay[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .filter((item): item is CancelledFlightDay => {
      return item
        && typeof item.flightId === 'number'
        && typeof item.fecha === 'string'
        && item.fecha.length >= 10
    })
    .map((item) => ({
      ...item,
      fecha: item.fecha.slice(0, 10),
      sourceType: item.sourceType ?? fallbackSource,
    }))
}

function readStorage(key: string, fallbackSource: CancelledFlightSource): CancelledFlightDay[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return []
    }

    return normalizeCancelledItems(JSON.parse(raw), fallbackSource)
  } catch {
    return []
  }
}

function writeStorage(key: string, entries: CancelledFlightDay[]) {
  window.localStorage.setItem(key, JSON.stringify(entries))
}

export function readRealCancelledFlightDays(): CancelledFlightDay[] {
  return readStorage(REAL_STORAGE_KEY, 'REAL')
    .filter((item) => (item.sourceType ?? 'REAL') === 'REAL')
}

export function readSimulationCancelledFlightDays(simulationId?: string | null): CancelledFlightDay[] {
  if (!simulationId) {
    return []
  }

  return readStorage(simulationStorageKey(simulationId), 'VIRTUAL')
    .filter((item) => (item.sourceType ?? 'VIRTUAL') === 'VIRTUAL')
    .map((item) => ({ ...item, simulationId }))
}

export function readCancelledFlightDays(options: ReadCancelledFlightDaysOptions = {}): CancelledFlightDay[] {
  const includeReal = options.includeReal ?? true
  const includeVirtual = options.includeVirtual ?? Boolean(options.simulationId)
  return [
    ...(includeReal ? readRealCancelledFlightDays() : []),
    ...(includeVirtual ? readSimulationCancelledFlightDays(options.simulationId) : []),
  ]
}

export function appendCancelledFlightDay(entry: CancelledFlightDay) {
  const sourceType = entry.sourceType ?? 'REAL'
  const simulationId = entry.simulationId ?? null
  if (sourceType === 'VIRTUAL' && !simulationId) {
    throw new Error('simulationId es obligatorio para guardar cancelaciones virtuales')
  }

  const storageKey = sourceType === 'VIRTUAL'
    ? simulationStorageKey(simulationId as string)
    : REAL_STORAGE_KEY
  const current = sourceType === 'VIRTUAL'
    ? readSimulationCancelledFlightDays(simulationId)
    : readRealCancelledFlightDays()
  const next = [
    ...current.filter((item) => !(
      item.flightId === entry.flightId
      && item.fecha.slice(0, 10) === entry.fecha.slice(0, 10)
      && (item.sourceType ?? sourceType) === sourceType
    )),
    {
      flightId: entry.flightId,
      fecha: entry.fecha.slice(0, 10),
      sourceType,
      simulationId,
      origen: entry.origen,
      destino: entry.destino,
      origenLat: entry.origenLat,
      origenLon: entry.origenLon,
      destinoLat: entry.destinoLat,
      destinoLon: entry.destinoLon,
      salidaMin: entry.salidaMin,
      llegadaMin: entry.llegadaMin,
    },
  ]
  writeStorage(storageKey, next)
  window.dispatchEvent(new CustomEvent('tasf:cancelled-flight-days-updated', {
    detail: { sourceType, simulationId },
  }))
}

export function buildCancelledFlightTraces(
  flights: FlightCrudDto[],
  airports: AirportCrudDto[],
  cancelledDays: CancelledFlightDay[],
  referenceDateKey: string | null,
  useAbsoluteMinuteIndices: boolean,
): CancelledFlightTrace[] {
  if (!referenceDateKey) {
    return []
  }

  const airportByCode = new Map(airports.map((airport) => [airport.codigoOaci.toUpperCase(), airport]))
  const referenceDayIndex = getDayIndexFromDateString(referenceDateKey)

  const storedTraces = cancelledDays.flatMap((item) => {
    if (item.fecha.slice(0, 10) !== referenceDateKey) {
      return []
    }

    if (
      typeof item.origenLat !== 'number' ||
      typeof item.origenLon !== 'number' ||
      typeof item.destinoLat !== 'number' ||
      typeof item.destinoLon !== 'number' ||
      typeof item.salidaMin !== 'number' ||
      typeof item.llegadaMin !== 'number'
    ) {
      return []
    }

    const offset = useAbsoluteMinuteIndices && referenceDayIndex !== null ? referenceDayIndex * 1440 : 0
    return [{
      flightId: item.flightId,
      sourceType: item.sourceType ?? 'REAL',
      origenLat: item.origenLat,
      origenLon: item.origenLon,
      destinoLat: item.destinoLat,
      destinoLon: item.destinoLon,
      salidaMin: offset + item.salidaMin,
      llegadaMin: offset + item.llegadaMin,
    }]
  })

  const storedKeys = new Set(storedTraces.map((trace) => `${trace.sourceType ?? 'REAL'}:${trace.flightId}`))

  const catalogTraces: CancelledFlightTrace[] = flights.flatMap((flight) => {
    if (!flight.id) {
      return []
    }

    const flightDateKey = normalizeDateKey(flight.salida)
    if (flightDateKey !== referenceDateKey) {
      return []
    }

    const isCancelled = flight.cancelado
      || cancelledDays.some((item) => {
        return (item.sourceType ?? 'REAL') === 'REAL'
          && item.flightId === flight.id
          && item.fecha.slice(0, 10) === referenceDateKey
      })
    if (!isCancelled) {
      return []
    }

    const origin = airportByCode.get(flight.origenOaci.toUpperCase())
    const destination = airportByCode.get(flight.destinoOaci.toUpperCase())
    if (!origin || !destination) {
      return []
    }

    const departureMinute = getMinuteOfDay(flight.salida)
    const arrivalMinute = getMinuteOfDay(flight.llegada)
    if (departureMinute === null || arrivalMinute === null) {
      return []
    }

    const offset = useAbsoluteMinuteIndices && referenceDayIndex !== null ? referenceDayIndex * 1440 : 0

    return [{
      flightId: flight.id,
      sourceType: 'REAL',
      origenLat: origin.latitud,
      origenLon: origin.longitud,
      destinoLat: destination.latitud,
      destinoLon: destination.longitud,
      salidaMin: offset + departureMinute,
      llegadaMin: offset + arrivalMinute,
    }]
  })

  return [
    ...storedTraces,
    ...catalogTraces.filter((trace) => !storedKeys.has(`${trace.sourceType ?? 'REAL'}:${trace.flightId}`)),
  ]
}
