import type { WsInitMessage } from '../types/sim'
import { formatClockFromMinute, formatCompactDate, formatDateFromDayIndex } from '../utils/time'

export type SimulationStatusProps = {
  meta: WsInitMessage | null
  currentMinute: number | null
  status: string
  preparingMessage?: string | null
}

export default function SimulationStatus({ meta, currentMinute, status, preparingMessage }: SimulationStatusProps) {
  if (!meta) {
    return <div className="timestamp">Esperando simulacion...</div>
  }

  if (preparingMessage) {
    return <div className="timestamp">{preparingMessage}</div>
  }

  if (status === 'READY' && currentMinute === null) {
    return (
      <div className="timestamp">
        {`Preparando simulacion hasta ${formatCompactDate(meta.inicio)}...`}
      </div>
    )
  }

  const minute = currentMinute ?? meta.diaMin * 1440
  const date = formatDateFromDayIndex(Math.floor(minute / 1440))
  const time = formatClockFromMinute(minute)

  return (
    <div className="timestamp">{`${date} - ${time}`}</div>
  )
}
