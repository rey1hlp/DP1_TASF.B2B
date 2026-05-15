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
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [currentMinute, setCurrentMinute] = useState<number | null>(null)
  const [segments, setSegments] = useState<FlightSegmentDto[]>([])
  const [meta, setMeta] = useState<WsInitMessage | null>(null)

  useEffect(() => {
    if (!simId) {
      setStatus('IDLE')
      setStatusMessage(null)
      setCurrentMinute(null)
      setSegments([])
      setMeta(null)
      socketRef.current = null
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
        setStatusMessage(null)
      }
      if (payload.type === 'tick') {
        setCurrentMinute(payload.minuto)
      }
      if (payload.type === 'status') {
        setStatus(payload.status)
        setStatusMessage(payload.message ?? null)
      }
    }

    ws.onclose = () => {
      setStatus('CLOSED')
      setStatusMessage('Conexion finalizada.')
    }

    return () => {
      ws.close()
    }
  }, [simId])

  const sendControl = (action: 'pause' | 'resume') => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    socketRef.current.send(JSON.stringify({ type: 'control', action }))
  }

  return {
    status,
    statusMessage,
    currentMinute,
    segments,
    meta,
    pause: () => sendControl('pause'),
    resume: () => sendControl('resume'),
  }
}
