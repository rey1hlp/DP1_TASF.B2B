export type ContinentName =
  | 'América'
  | 'Europa'
  | 'África'
  | 'Asia'
  | 'Oceanía'
  | 'Antártida'

export function deriveContinentFromCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): ContinentName | '' {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return ''
  }

  if (latitude <= -60) {
    return 'Antártida'
  }

  if (longitude >= -170 && longitude <= -25 && latitude >= -60 && latitude <= 85) {
    return 'América'
  }

  if (longitude >= -25 && longitude <= 60 && latitude >= 34 && latitude <= 72) {
    return 'Europa'
  }

  if (longitude >= -20 && longitude <= 55 && latitude >= -35 && latitude < 34) {
    return 'África'
  }

  if (longitude >= 110 && longitude <= 180 && latitude >= -50 && latitude < 10) {
    return 'Oceanía'
  }

  if (longitude >= 60 && longitude <= 180 && latitude >= -10 && latitude <= 80) {
    return 'Asia'
  }

  if (longitude >= 25 && longitude < 60 && latitude >= 5 && latitude < 42) {
    return 'Asia'
  }

  if (longitude >= 95 && longitude <= 180 && latitude >= -50 && latitude < -10) {
    return 'Oceanía'
  }

  if (longitude >= -30 && longitude < 25 && latitude >= 0 && latitude < 35) {
    return 'África'
  }

  return ''
}

export function resolveAirportContinent(
  continent: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  const normalized = (continent ?? '').trim()
  if (normalized) {
    return normalized
  }

  return deriveContinentFromCoordinates(latitude, longitude)
}
