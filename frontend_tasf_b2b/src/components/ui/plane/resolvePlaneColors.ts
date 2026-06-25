import {
  NEUTRAL_SEMAPHORE_COLORS,
  resolveSemaphoreColor,
  type SemaphoreRanges,
} from '../../../utils/semaphore'

export type { SemaphoreRanges }

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

  const colors = percent === null
    ? NEUTRAL_SEMAPHORE_COLORS
    : resolveSemaphoreColor(percent, ranges)
  const isEmpty = carga === 0

  return {
    fill: isEmpty ? 'none' : colors.fill,
    stroke: colors.stroke,
    strokeWidth: isEmpty ? 1.8 : 1.5,
  }
}
