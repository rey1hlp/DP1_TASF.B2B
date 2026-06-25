const MS_PER_DAY = 24 * 60 * 60 * 1000
const LOCALE = 'es-PE'

const integerFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
})

function formatDecimal(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

function parseCompactDate(value?: string | null): Date | null {
  if (!value) {
    return null
  }
  if (/^\d{8}$/.test(value)) {
    const yyyy = Number(value.slice(0, 4))
    const mm = Number(value.slice(4, 6)) - 1
    const dd = Number(value.slice(6, 8))
    return new Date(Date.UTC(yyyy, mm, dd))
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split('-').map(Number)
    return new Date(Date.UTC(yyyy, mm - 1, dd))
  }
  return null
}

export function formatCompactDate(value?: string | null): string {
  const d = parseCompactDate(value)
  if (!d) {
    return '--'
  }
  const yyyy = d.getUTCFullYear()
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getUTCDate()}`.padStart(2, '0')
  return `${dd}/${mm}/${yyyy}`
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return '--'
  }
  const compact = formatCompactDate(value.substring(0, 10))
  if (compact !== '--') {
    return compact
  }
  if (/^\d{8}$/.test(value)) {
    return formatCompactDate(value)
  }
  return value
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return '--'
  }
  if (value instanceof Date) {
    return new Intl.DateTimeFormat(LOCALE, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value)
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  const match = hasTimezone
    ? null
    : value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  if (match) {
    const [, yyyy, mm, dd, hh, min] = match
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateTime(parsed)
  }

  return value
}

export function getInclusiveDaySpan(start?: string | null, end?: string | null): number | null {
  const startDate = parseCompactDate(start)
  const endDate = parseCompactDate(end)
  if (!startDate || !endDate) {
    return null
  }
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY)
  return Math.max(1, diff + 1)
}

export function getDayIndexFromDateString(value?: string | null): number | null {
  const date = parseCompactDate(value)
  if (!date) {
    return null
  }
  return Math.floor(date.getTime() / MS_PER_DAY)
}

export function formatDateFromDayIndex(dayIndex: number): string {
  const ms = dayIndex * MS_PER_DAY
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getUTCDate()}`.padStart(2, '0')
  return `${dd}/${mm}/${yyyy}`
}

export function formatIsoDateFromDayIndex(dayIndex: number): string {
  const ms = dayIndex * MS_PER_DAY
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getUTCDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatClockFromMinute(minute: number): string {
  const totalMin = Math.max(0, minute)
  const hh = Math.floor((totalMin / 60) % 24)
  const mm = totalMin % 60
  return `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`
}

export function formatSimMinute(minute?: number | null, includeDate = false): string {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) {
    return '--'
  }
  const roundedMinute = Math.floor(minute)
  const clock = formatClockFromMinute(roundedMinute)
  if (!includeDate) {
    return clock
  }
  const date = formatDateFromDayIndex(Math.floor(roundedMinute / 1440))
  return `${date} ${clock}`
}

export function formatMinuteRange(start?: number | null, end?: number | null): string {
  if (start === null || start === undefined || end === null || end === undefined) {
    return '--'
  }
  const startDay = Math.floor(start / 1440)
  const endDay = Math.floor(end / 1440)
  const includeDate = startDay !== 0 || endDay !== 0
  if (includeDate && startDay !== endDay) {
    return `${formatSimMinute(start, true)} - ${formatSimMinute(end, true)}`
  }
  return `${formatSimMinute(start, includeDate)} - ${formatSimMinute(end, false)}`
}

export function formatInteger(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--'
  }
  return integerFormatter.format(value)
}

export function formatPercent(value?: number | null, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--'
  }
  return `${formatDecimal(value, fractionDigits)}%`
}

export function formatBags(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--'
  }
  return `${formatInteger(Math.round(value))}`
}

export function formatDurationHours(value?: number | null, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--'
  }
  return `${formatDecimal(value, fractionDigits)} h`
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '--'
  }
  if (bytes >= 1024 * 1024) {
    return `${formatDecimal(bytes / 1024 / 1024, 2)} MB`
  }
  return `${formatDecimal(bytes / 1024, 2)} KB`
}

export function formatGmtOffset(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'GMT --'
  }
  return `GMT${value >= 0 ? '+' : ''}${value}`
}
