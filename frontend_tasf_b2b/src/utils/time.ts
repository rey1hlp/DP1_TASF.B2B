export function formatDateFromDayIndex(dayIndex: number): string {
  const ms = dayIndex * 24 * 60 * 60 * 1000
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getUTCDate()}`.padStart(2, '0')
  return `${yyyy}/${mm}/${dd}`
}

export function formatClockFromMinute(minute: number): string {
  const totalMin = Math.max(0, minute)
  const hh = Math.floor((totalMin / 60) % 24)
  const mm = totalMin % 60
  return `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`
}
