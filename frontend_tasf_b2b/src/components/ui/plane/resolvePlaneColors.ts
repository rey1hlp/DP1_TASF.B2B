export const NEUTRAL_COLORS = { stroke: '#b8923f', fill: '#e8c97a' }

export type SemaphoreRanges = { greenMax: number; amberMax: number }

export function resolveSemaphoreColor(percent: number, ranges: SemaphoreRanges) {
  if (percent <= ranges.greenMax) return { stroke: '#2f8f46', fill: '#54b86c' }
  if (percent <= ranges.amberMax) return { stroke: '#d3952a', fill: '#f0be62' }
  return { stroke: '#c4473d', fill: '#e36b60' }
}

export type PlaneColorResult = {
  fill: string
  stroke: string
  strokeWidth: number
}

export function resolvePlaneColors(
  carga: number,
  capacidad: number | undefined,
  ranges: SemaphoreRanges,
): PlaneColorResult {
  const percent =
    capacidad !== undefined && capacidad > 0
      ? (carga / capacidad) * 100
      : null

  const colors = percent === null ? NEUTRAL_COLORS : resolveSemaphoreColor(percent, ranges)
  const isEmpty = carga === 0

  return {
    fill: isEmpty ? 'none' : colors.fill,
    stroke: colors.stroke,
    strokeWidth: isEmpty ? 1.8 : 1.5,
  }
}