// src/contexts/SimulationContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useSimulationSocket } from '../hooks/useSimulationSocket'
import type { FlightSegmentDto, WsAppendMessage, WsInitMessage } from '../types/sim'

interface SimulationState {
  simId: string | null
  requestedStart: string | null
  requestedDays: number | null
  displayOffset: number | null
  localCompleted: boolean
  ranges: { greenMax: number; amberMax: number }
}

interface SimulationContextType {
  enviosKey: string | null
  setEnviosKey: (key: string | null) => void
  simulation: SimulationState
  setSimulation: React.Dispatch<React.SetStateAction<SimulationState>>
  resetSimulation: () => void
  status: string
  statusMessage: string | null
  currentMinute: number | null
  segments: FlightSegmentDto[]
  meta: WsInitMessage | WsAppendMessage | null
  pause: () => void
  resume: () => void
  setSpeed: (speedMinPerSec: number) => void
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [enviosKey, setEnviosKey] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<SimulationState>({
    simId: null,
    requestedStart: null,
    requestedDays: null,
    displayOffset: null,
    localCompleted: false,
    ranges: { greenMax: 30, amberMax: 70 },
  })
  const { status, statusMessage, currentMinute, segments, meta, pause, resume, setSpeed } =
    useSimulationSocket(simulation.simId)

  const resetSimulation = () => {
    setSimulation({
      simId: null,
      requestedStart: null,
      requestedDays: null,
      displayOffset: null,
      localCompleted: false,
      ranges: { greenMax: 30, amberMax: 70 },
    })
  }

  return (
    <SimulationContext.Provider
      value={{
        enviosKey,
        setEnviosKey,
        simulation,
        setSimulation,
        resetSimulation,
        status,
        statusMessage,
        currentMinute,
        segments,
        meta,
        pause,
        resume,
        setSpeed,
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulationContext() {
  const context = useContext(SimulationContext)
  if (!context) {
    throw new Error('useSimulationContext debe usarse dentro de SimulationProvider')
  }
  return context
}
