import type { ReactNode } from 'react'

type MapFloatingCardMetric = {
  label: string
  value: string
}

type MapFloatingCardProps = {
  actionLabel: string
  badge: string
  metrics: MapFloatingCardMetric[]
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  onAction: () => void
  onClose: () => void
  statusColor: string
  statusLabel: string
  subtitle: string
  title: ReactNode
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

      <div className="map-floating-card-body">
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

        <button
          type="button"
          className="map-floating-card-action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
