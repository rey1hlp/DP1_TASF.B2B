export type SemaphoreRanges = {
  greenMax: number
  amberMax: number
}

export type SemaphoreLevel = 'green' | 'amber' | 'red' | 'unknown'

export type SemaphoreColor = {
  stroke: string
  fill: string
}

export const NEUTRAL_SEMAPHORE_COLORS: SemaphoreColor = {
  stroke: '#b8923f',
  fill: '#e8c97a',
}

export const SEMAPHORE_COLORS: Record<Exclude<SemaphoreLevel, 'unknown'>, SemaphoreColor> = {
  green: {
    stroke: '#2f8f46',
    fill: '#54b86c',
  },
  amber: {
    stroke: '#d3952a',
    fill: '#f0be62',
  },
  red: {
    stroke: '#c4473d',
    fill: '#e36b60',
  },
}

export function resolveSemaphoreLevel(
  percent: number | null | undefined,
  ranges: SemaphoreRanges
): SemaphoreLevel {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return 'unknown'
  }

  if (percent <= ranges.greenMax) {
    return 'green'
  }

  if (percent <= ranges.amberMax) {
    return 'amber'
  }

  return 'red'
}

export function resolveSemaphoreColor(
  percent: number | null | undefined,
  ranges: SemaphoreRanges
) {
  const level = resolveSemaphoreLevel(percent, ranges)
  return level === 'unknown' ? NEUTRAL_SEMAPHORE_COLORS : SEMAPHORE_COLORS[level]
}
