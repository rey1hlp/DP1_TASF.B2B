const MS_PER_DAY = 24 * 60 * 60 * 1000
const LOCALE = 'es-PE'
const MONTH_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

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

function formatDateTimeParts(year: number, monthIndex: number, day: number, hours: number, minutes: number): string {
  const month = MONTH_SHORT_ES[Math.max(0, Math.min(11, monthIndex))]
  return `${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatUtcDateTime(value: Date): string {
  return formatDateTimeParts(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    value.getUTCHours(),
    value.getUTCMinutes(),
  )
}

function normalizeGmtOffsetMinutes(value?: number | null): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  return Math.round(value * 60)
}

export function shiftAbsoluteMinuteByGmt(minute: number, gmt?: number | null): number {
  const offsetMinutes = normalizeGmtOffsetMinutes(gmt)
  return offsetMinutes === null ? minute : minute + offsetMinutes
}

function shiftDateByGmt(value: Date, gmt?: number | null): Date {
  const offsetMinutes = normalizeGmtOffsetMinutes(gmt)
  if (offsetMinutes === null) {
    return value
  }
  return new Date(value.getTime() + offsetMinutes * 60 * 1000)
}

function formatDateTimeWithGmt(value: Date, gmt?: number | null): string {
  const shifted = shiftDateByGmt(value, gmt)
  return formatDateTimeParts(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
  )
}

export function formatDateTime(value?: string | Date | number | null): string {
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return formatDateTimeParts(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
    )
  }
  if (value instanceof Date) {
    return formatDateTimeParts(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
    )
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  const match = hasTimezone
    ? null
    : value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  if (match) {
    const [, yyyy, mm, dd, hh, min] = match
    return formatDateTimeParts(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateTime(parsed)
  }

  return value
}

export function formatSimSpan(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes))
  const days = Math.floor(safeMinutes / 1440)
  const remainingMinutes = safeMinutes % 1440
  const hours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60

  if (days > 0) {
    return hours > 0 ? `${days} d ${hours} h` : `${days} d`
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  }

  return `${minutes} min`
}

export function formatElapsedReal(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} min`
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

export function formatSimDateTimeFromMinute(minute?: number | null): string {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) {
    return '--'
  }

  const roundedMinute = Math.max(0, Math.floor(minute))
  const dayIndex = Math.floor(roundedMinute / 1440)
  const ms = dayIndex * MS_PER_DAY
  const d = new Date(ms)
  const hours = Math.floor((roundedMinute / 60) % 24)
  const minutes = roundedMinute % 60

  return formatDateTimeParts(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    hours,
    minutes,
  )
}

export function formatSimMinuteWithGmt(
  minute?: number | null,
  gmt?: number | null,
  includeDate = false,
): string {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) {
    return '--'
  }
  return formatSimMinute(
    shiftAbsoluteMinuteByGmt(Math.floor(minute), gmt),
    includeDate,
  )
}

export function formatSimDateTimeFromMinuteWithGmt(
  minute?: number | null,
  gmt?: number | null,
): string {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) {
    return '--'
  }
  return formatSimDateTimeFromMinute(
    shiftAbsoluteMinuteByGmt(Math.floor(minute), gmt),
  )
}

export function parseShipmentDepartureMinute(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const trimmed = value.trim()
  const minuteMatch = trimmed.match(/^min(?:uto)?\.?\s*(\d+)$/i)
  if (minuteMatch) {
    return Number(minuteMatch[1])
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  return null
}

export function formatShipmentDepartureTime(
  value?: string | number | null,
  gmt?: number | null,
): string {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const minute = parseShipmentDepartureMinute(value)
  if (minute !== null) {
    return formatSimDateTimeFromMinuteWithGmt(minute, gmt)
  }

  const raw = String(value).trim()
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)
  const parsed = new Date(raw)
  if (hasTimezone && !Number.isNaN(parsed.getTime())) {
    if (normalizeGmtOffsetMinutes(gmt) !== null) {
      return formatDateTimeWithGmt(parsed, gmt)
    }
    return `${formatUtcDateTime(parsed)} UTC`
  }

  const formattedDateTime = formatDateTime(raw)
  return formattedDateTime === raw ? raw : formattedDateTime
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

export function formatMinuteRangeWithGmt(
  start?: number | null,
  end?: number | null,
  startGmt?: number | null,
  endGmt?: number | null,
): string {
  if (start === null || start === undefined || end === null || end === undefined) {
    return '--'
  }

  const localizedStart = shiftAbsoluteMinuteByGmt(Math.floor(start), startGmt)
  const localizedEnd = shiftAbsoluteMinuteByGmt(Math.floor(end), endGmt)
  const startDay = Math.floor(localizedStart / 1440)
  const endDay = Math.floor(localizedEnd / 1440)
  const hasDifferentOffsets =
    normalizeGmtOffsetMinutes(startGmt) !== normalizeGmtOffsetMinutes(endGmt)
  const includeFullDate = hasDifferentOffsets || startDay !== endDay
  const includeDate = includeFullDate || startDay !== 0 || endDay !== 0

  if (includeFullDate) {
    return `${formatSimMinute(localizedStart, true)} - ${formatSimMinute(localizedEnd, true)}`
  }

  return `${formatSimMinute(localizedStart, includeDate)} - ${formatSimMinute(localizedEnd, false)}`
}

export function formatOperationalMinuteRange(start?: number | null, end?: number | null): string {
  if (start === null || start === undefined || end === null || end === undefined) {
    return '--'
  }

  const startMinute = Math.floor(start)
  const endMinute = Math.floor(end)
  const startLabel = formatClockFromMinute(startMinute)
  const endLabel = formatClockFromMinute(endMinute)
  const dayDiff = Math.floor(endMinute / 1440) - Math.floor(startMinute / 1440)

  if (dayDiff <= 0) {
    return `${startLabel} - ${endLabel}`
  }

  return `${startLabel} - ${endLabel} (+${dayDiff}d)`
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
