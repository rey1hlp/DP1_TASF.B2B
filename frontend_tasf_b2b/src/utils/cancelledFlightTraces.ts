import type { AirportCrudDto, FlightCrudDto } from '../types/sim'
import { getDayIndexFromDateString } from './time'

export type CancelledFlightTrace = {
  flightId: number
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
  origen?: string
  destino?: string
  origenLat?: number
  origenLon?: number
  destinoLat?: number
  destinoLon?: number
  salidaMin?: number
  llegadaMin?: number
}

const STORAGE_KEY = 'tasf.cancelled_flight_days'

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

export function readCancelledFlightDays(): CancelledFlightDay[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as CancelledFlightDay[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item) => {
      return item
        && typeof item.flightId === 'number'
        && typeof item.fecha === 'string'
        && item.fecha.length >= 10
    })
  } catch {
    return []
  }
}

export function appendCancelledFlightDay(entry: CancelledFlightDay) {
  const current = readCancelledFlightDays()
  const next = [
    ...current.filter((item) => !(item.flightId === entry.flightId && item.fecha.slice(0, 10) === entry.fecha.slice(0, 10))),
    {
      flightId: entry.flightId,
      fecha: entry.fecha.slice(0, 10),
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('tasf:cancelled-flight-days-updated'))
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
      origenLat: item.origenLat,
      origenLon: item.origenLon,
      destinoLat: item.destinoLat,
      destinoLon: item.destinoLon,
      salidaMin: offset + item.salidaMin,
      llegadaMin: offset + item.llegadaMin,
    }]
  })

  if (storedTraces.length > 0) {
    return storedTraces
  }

  return flights.flatMap((flight) => {
    if (!flight.id) {
      return []
    }

    const flightDateKey = normalizeDateKey(flight.salida)
    if (flightDateKey !== referenceDateKey) {
      return []
    }

    const isCancelled = flight.cancelado || cancelledDays.some((item) => item.flightId === flight.id && item.fecha.slice(0, 10) === referenceDateKey)
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
      origenLat: origin.latitud,
      origenLon: origin.longitud,
      destinoLat: destination.latitud,
      destinoLon: destination.longitud,
      salidaMin: offset + departureMinute,
      llegadaMin: offset + arrivalMinute,
    }]
  })
}
