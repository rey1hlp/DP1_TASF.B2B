import type { ReactNode } from 'react'

type MapFloatingCardMetric = {
  label: string
  value: string
}

type MapFloatingCardProps = {
  actionLabel?: string
  badge: string
  metrics: MapFloatingCardMetric[]
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  onAction?: () => void
  onClose: () => void
  statusColor: string
  statusLabel: string
  subtitle: string
  title: ReactNode
  loading?: boolean
}

export default function MapFloatingCard({
  actionLabel,
  badge,
  metrics,
  secondaryActionLabel,
  onSecondaryAction,
  onAction,
  onClose,
  statusColor,
  statusLabel,
  subtitle,
  title,
  loading = false,
}: MapFloatingCardProps) {
  return (
    <div className="map-floating-card">
      <div className="map-floating-card-header">
        <div className="map-floating-card-title">
          <span className="map-floating-card-badge">{badge}</span>
          <strong>{title}</strong>
        </div>
        <button
          type="button"
          className="map-floating-card-close"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          ×
        </button>
      </div>

      <div className="map-floating-card-body" style={{ position: 'relative', minHeight: '120px' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: '600',
            borderRadius: '8px',
            zIndex: 10,
            backdropFilter: 'blur(1px)'
          }}>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '3px solid rgba(255,255,255,0.3)',
                borderTop: '3px solid #fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '13px' }}>Cargando...</span>
            </div>
          </div>
        )}

        <div className="map-floating-card-subtitle">{subtitle}</div>

        <div className="map-floating-card-metrics">
          {metrics.map((metric) => (
            <div className="map-floating-card-metric" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>

        <div className="map-floating-card-status">
          <span style={{ background: statusColor }} />
          <div>{statusLabel}</div>
        </div>

        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            className="map-floating-card-action"
            onClick={onSecondaryAction}
          >
            {secondaryActionLabel}
          </button>
        ) : null}

        {actionLabel && onAction ? (
          <button
            type="button"
            className="map-floating-card-action"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
