import { useState } from 'react'

export type SimulationControlsProps = {
  onStart: (payload: { inicio: string; dias: number }) => void
  isRunning: boolean
}

export default function SimulationControls({ onStart, isRunning }: SimulationControlsProps) {
  const [inicio, setInicio] = useState('2026-02-15')
  const [dias, setDias] = useState(3)

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

      <label className="field">
        Rango Semaforo Verde
        <input type="text" defaultValue="0% - 30%" />
      </label>
      <label className="field">
        Rango Semaforo Ambar
        <input type="text" defaultValue="30% - 70%" />
      </label>
      <label className="field">
        Rango Semaforo Rojo
        <input type="text" defaultValue="70% - 100%" />
      </label>

      <div className="buttons">
        <button
          className="btn primary"
          onClick={() => onStart({ inicio, dias })}
          disabled={isRunning}
        >
          {isRunning ? 'Ejecutando...' : 'Iniciar'}
        </button>
        <button className="btn" disabled>
          Pausar
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
