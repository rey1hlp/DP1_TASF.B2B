export type MapLatLng = [number, number]

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function normalizeLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180
}

function unwrapLongitude(longitude: number, reference: number) {
  let adjusted = longitude

  while (adjusted - reference > 180) {
    adjusted -= 360
  }

  while (adjusted - reference < -180) {
    adjusted += 360
  }

  return adjusted
}

function getGreatCircleParameters(start: MapLatLng, end: MapLatLng) {
  const [startLat, startLon] = start
  const [endLat, endLon] = end

  const phi1 = toRadians(startLat)
  const phi2 = toRadians(endLat)
  const lambda1 = toRadians(startLon)
  const lambda2 = toRadians(endLon)

  const sinHalfLat = Math.sin((phi2 - phi1) / 2)
  const sinHalfLon = Math.sin((lambda2 - lambda1) / 2)
  const a =
    sinHalfLat * sinHalfLat +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfLon * sinHalfLon
  const delta = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  const sinDelta = Math.sin(delta)

  return {
    start,
    end,
    startLat,
    startLon,
    endLat,
    endLon,
    phi1,
    phi2,
    lambda1,
    lambda2,
    delta,
    sinDelta,
  }
}

export function getGeodesicPointAtProgress(start: MapLatLng, end: MapLatLng, progress: number): MapLatLng {
  const params = getGreatCircleParameters(start, end)
  const clampedProgress = Math.min(1, Math.max(0, progress))

  if (params.delta < 1e-6 || Math.abs(params.sinDelta) < 1e-6) {
    const latitude = params.startLat + (params.endLat - params.startLat) * clampedProgress
    const longitude = params.startLon + (params.endLon - params.startLon) * clampedProgress
    return [latitude, longitude]
  }

  const weightStart = Math.sin((1 - clampedProgress) * params.delta) / params.sinDelta
  const weightEnd = Math.sin(clampedProgress * params.delta) / params.sinDelta

  const x =
    weightStart * Math.cos(params.phi1) * Math.cos(params.lambda1) +
    weightEnd * Math.cos(params.phi2) * Math.cos(params.lambda2)
  const y =
    weightStart * Math.cos(params.phi1) * Math.sin(params.lambda1) +
    weightEnd * Math.cos(params.phi2) * Math.sin(params.lambda2)
  const z = weightStart * Math.sin(params.phi1) + weightEnd * Math.sin(params.phi2)

  const latitude = toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)))
  const longitude = unwrapLongitude(normalizeLongitude(toDegrees(Math.atan2(y, x))), params.startLon)

  return [latitude, longitude]
}

export function buildGeodesicArcPoints(start: MapLatLng, end: MapLatLng): MapLatLng[] {
  const params = getGreatCircleParameters(start, end)

  if (params.delta < 1e-6) {
    return [start, end]
  }

  const segmentCount = Math.min(64, Math.max(12, Math.ceil(toDegrees(params.delta) / 4)))

  if (Math.abs(params.sinDelta) < 1e-6) {
    return [start, end]
  }

  const points: MapLatLng[] = [start]
  let previousLongitude = params.startLon

  for (let index = 1; index < segmentCount; index += 1) {
    const [latitude, rawLongitude] = getGeodesicPointAtProgress(start, end, index / segmentCount)
    const longitude = unwrapLongitude(rawLongitude, previousLongitude)

    points.push([latitude, longitude])
    previousLongitude = longitude
  }

  points.push([params.endLat, unwrapLongitude(params.endLon, previousLongitude)])
  return points
}
