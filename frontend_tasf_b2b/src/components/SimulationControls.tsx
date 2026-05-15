import { useState } from 'react'

export type SimulationControlsProps = {
  onStart: (payload: { inicio: string; dias: number }) => void
  onPause: () => void
  onResume: () => void
  isRunning: boolean
  isPaused: boolean
  ranges: { greenMax: number; amberMax: number }
  onRangesChange: (ranges: { greenMax: number; amberMax: number }) => void
}

export default function SimulationControls({
  onStart,
  onPause,
  onResume,
  isRunning,
  isPaused,
  ranges,
  onRangesChange,
}: SimulationControlsProps) {
  const [inicio, setInicio] = useState('2026-02-15')
  const [dias, setDias] = useState(3)

  const greenMax = ranges.greenMax
  const amberMax = ranges.amberMax

  const handleGreenChange = (value: number) => {
    const next = Math.min(value, amberMax - 1)
    onRangesChange({ greenMax: Math.max(0, next), amberMax })
  }

  const handleAmberChange = (value: number) => {
    const next = Math.max(value, greenMax + 1)
    onRangesChange({ greenMax, amberMax: Math.min(100, next) })
  }

  return (
    <div className="control-panel">
      <h3>Configuracion de simulacion</h3>
      <div className="chip-row">
        <button
          className={`chip ${dias === 3 ? 'active' : ''}`}
          onClick={() => setDias(3)}
        >
          3 dias
        </button>
        <button
          className={`chip ${dias === 5 ? 'active' : ''}`}
          onClick={() => setDias(5)}
        >
          5 dias
        </button>
        <button
          className={`chip ${dias === 7 ? 'active' : ''}`}
          onClick={() => setDias(7)}
        >
          7 dias
        </button>
      </div>

      <label className="field">
        Fecha de inicio
        <input
          type="date"
          value={inicio}
          onChange={(event) => setInicio(event.target.value)}
        />
      </label>

      <div className="field">
        <div className="field-label">Rangos de semaforo</div>
        <div className="range-row">
          <span className="range-label">Verde</span>
          <input
            type="range"
            min={0}
            max={100}
            value={greenMax}
            onChange={(event) => handleGreenChange(Number(event.target.value))}
          />
          <span className="range-value">{`0% - ${greenMax}%`}</span>
        </div>
        <div className="range-row">
          <span className="range-label">Ambar</span>
          <input
            type="range"
            min={0}
            max={100}
            value={amberMax}
            onChange={(event) => handleAmberChange(Number(event.target.value))}
          />
          <span className="range-value">{`${greenMax}% - ${amberMax}%`}</span>
        </div>
        <div className="range-row">
          <span className="range-label">Rojo</span>
          <div className="range-static">{`${amberMax}% - 100%`}</div>
        </div>
      </div>

      <div className="buttons">
        <button
          className="btn primary"
          onClick={() => onStart({ inicio, dias })}
          disabled={isRunning}
        >
          {isRunning ? 'Ejecutando...' : 'Iniciar'}
        </button>
        <button
          className="btn"
          onClick={isPaused ? onResume : onPause}
          disabled={!isRunning}
        >
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
        <button className="btn ghost" disabled>
          Exportar CSV
        </button>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <div className="metric-value">0.1</div>
          <div className="metric-label">Disponible/Lleno</div>
        </div>
        <div className="metric">
          <div className="metric-value">90</div>
          <div className="metric-label">Maletas en riesgo</div>
        </div>
        <div className="metric">
          <div className="metric-value">12</div>
          <div className="metric-label">Cancelaciones</div>
        </div>
        <div className="metric">
          <div className="metric-value">1h 20m</div>
          <div className="metric-label">Prom. Tiempo Espera</div>
        </div>
      </div>

      <div className="progress-block">
        <div className="progress-title">Progreso de simulacion</div>
        <div className="progress-item">
          <span>Completado</span>
          <div className="bar"><div style={{ width: '58%' }} /></div>
        </div>
        <div className="progress-item">
          <span>Capacidad Promedio</span>
          <div className="bar"><div style={{ width: '46%' }} /></div>
        </div>
        <div className="progress-item">
          <span>Eficiencia de Rutas</span>
          <div className="bar"><div style={{ width: '74%' }} /></div>
        </div>
      </div>

      <div className="warehouse">
        <h4>Ocupacion de almacenes</h4>
        <div className="warehouse-item">EIDW - Dublin <span>90%</span></div>
        <div className="warehouse-item">JFK - Nueva York <span>50%</span></div>
        <div className="warehouse-item">SIN - Singapur <span>20%</span></div>
        <div className="warehouse-item">HND - Tokio <span>80%</span></div>
        <div className="warehouse-item">SYD - Sidney <span>60%</span></div>
      </div>
    </div>
  )
}
