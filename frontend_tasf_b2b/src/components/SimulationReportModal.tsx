import { formatCompactDate } from '../utils/time'
import { formatInteger } from '../utils/time'
import './SimulationReportModal.css'

interface SimulationReportModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'period' | 'collapse'
  meta: any
  statusMessage: string | null
  stats: any
}

export default function SimulationReportModal({
  isOpen,
  onClose,
  mode,
  meta,
  statusMessage,
  stats
}: SimulationReportModalProps) {
  if (!isOpen || !meta) return null

  const isCollapse = mode === 'collapse' && statusMessage && statusMessage.includes('Colapso')

  return (
    <div className="simulation-report-modal-overlay">
      <div className="simulation-report-modal">
        <header className="simulation-report-modal-header">
          <h2>
            {isCollapse ? 'Reporte de Colapso' : 'Resumen de Simulación'}
          </h2>
          <button className="close-button" onClick={onClose} aria-label="Cerrar">&times;</button>
        </header>
        <div className="simulation-report-modal-body">
          {isCollapse && (
            <div className="report-collapse-alert">
              <strong>¡Colapso Detectado!</strong>
              <p>{statusMessage}</p>
            </div>
          )}

          <div className="report-section">
            <h3>Datos Generales de la Planificación</h3>
            <div className="report-grid">
              <div className="report-item">
                <span className="report-label">Periodo:</span>
                <span className="report-value">
                  {formatCompactDate(meta.inicio)} - {formatCompactDate(meta.fin)}
                </span>
              </div>
              <div className="report-item">
                <span className="report-label">Total Envíos:</span>
                <span className="report-value">{formatInteger(meta.totalEnvios)}</span>
              </div>
              <div className="report-item">
                <span className="report-label">Total Maletas:</span>
                <span className="report-value">{formatInteger(meta.totalMaletas)}</span>
              </div>
              <div className="report-item">
                <span className="report-label">Días Extra:</span>
                <span className="report-value">{meta.diasExtra ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h3>Estadísticas Finales (última foto de la simulación)</h3>
            <div className="report-grid">
              {stats.cards.map((card: any, index: number) => (
                <div className="report-item" key={index}>
                  <span className="report-label" style={{ color: card.labelColor }}>{card.label}:</span>
                  <span className="report-value" style={card.color ? { backgroundColor: card.color, color: card.textColor, padding: '2px 6px', borderRadius: '4px' } : {}}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="report-bars" style={{ marginTop: '1rem' }}>
              {stats.bars.map((bar: any, index: number) => (
                <div className="report-bar-item" key={index} style={{ marginBottom: '8px' }}>
                  <div className="report-bar-label" style={{ fontSize: '13px', marginBottom: '2px', color: '#5f6f8e' }}>
                    {bar.label}: {Math.round(bar.value)}%
                  </div>
                  <div className="report-bar-track" style={{ height: '8px', background: '#e0e5eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="report-bar-fill" style={{ height: '100%', width: `${Math.min(100, Math.max(0, bar.value))}%`, background: '#2563eb' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="simulation-report-modal-footer">
          <button className="btn-primary" onClick={onClose}>Aceptar</button>
        </footer>
      </div>
    </div>
  )
}
