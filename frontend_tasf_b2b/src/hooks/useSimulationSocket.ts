import { useEffect, useRef, useState } from 'react'
import type {
  FlightSegmentDto,
  WsMessage,
  WsInitMessage,
  WsAppendMessage,
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
      if (event.data != null && event.data !== '') {
        console.debug('[WS] message bytes=', typeof event.data === 'string' ? event.data.length : 'binary')
      }
      const payload = JSON.parse(event.data) as WsMessage
      if (payload.type === 'init') {
        const init = payload as WsInitMessage
        setMeta(init)
        setSegments(init.vuelos)
        setStatus('READY')
        setStatusMessage(null)
      }
      if (payload.type === 'append') {
        const append = payload as WsAppendMessage
        setMeta(append)
        setSegments((prev) => {
          const merged = [...prev, ...(append.vuelos ?? [])]
          const seen = new Set<string>()
          const deduped: FlightSegmentDto[] = []
          for (const seg of merged) {
            const key = `${seg.flightId}_${seg.planId}_${seg.salidaMin}_${seg.llegadaMin}`
            if (seen.has(key)) continue
            seen.add(key)
            deduped.push(seg)
          }
          deduped.sort((left, right) => left.salidaMin - right.salidaMin || left.flightId - right.flightId)
          return deduped
        })
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
