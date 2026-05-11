import type { WsInitMessage } from '../types/sim'
import { formatClockFromMinute, formatDateFromDayIndex } from '../utils/time'

export type SimulationStatusProps = {
  meta: WsInitMessage | null
  currentMinute: number | null
}

export default function SimulationStatus({ meta, currentMinute }: SimulationStatusProps) {
  if (!meta) {
    return <div className="timestamp">Esperando simulacion...</div>
  }

  const date = formatDateFromDayIndex(Math.floor(currentMinute ? currentMinute / 1440 : meta.diaMin))
  const time = formatClockFromMinute(currentMinute ?? meta.diaMin * 1440)

  return (
    <div className="timestamp">{`${date} - ${time}`}</div>
  )
}
