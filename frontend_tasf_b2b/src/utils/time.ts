const MS_PER_DAY = 24 * 60 * 60 * 1000

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
