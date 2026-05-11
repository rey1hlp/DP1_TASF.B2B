import { useEffect, useRef, useState } from 'react'
import type {
  FlightSegmentDto,
  WsMessage,
  WsInitMessage,
} from '../types/sim'
import { buildWsUrl } from '../services/api'

export function useSimulationSocket(simId: string | null) {
  const socketRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<string>('IDLE')
  const [currentMinute, setCurrentMinute] = useState<number | null>(null)
  const [segments, setSegments] = useState<FlightSegmentDto[]>([])
  const [meta, setMeta] = useState<WsInitMessage | null>(null)

  useEffect(() => {
    if (!simId) {
      return
    }

    const ws = new WebSocket(buildWsUrl(simId))
    socketRef.current = ws

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data) as WsMessage
      if (payload.type === 'init') {
        const init = payload as WsInitMessage
        setMeta(init)
        setSegments(init.vuelos)
        setStatus('READY')
      }
      if (payload.type === 'tick') {
        setCurrentMinute(payload.minuto)
      }
      if (payload.type === 'status') {
        setStatus(payload.status)
      }
    }

    ws.onclose = () => {
      setStatus('CLOSED')
    }

    return () => {
      ws.close()
    }
  }, [simId])

  return {
    status,
    currentMinute,
    segments,
    meta,
  }
}
