import type { ReactNode } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  headerActions?: ReactNode
  children?: ReactNode
  className?: string
}

export default function Modal({ open, onClose, title, headerActions, children, className }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${className ? ` ${className}` : ''}`} onClick={(e) => e.stopPropagation()}>
        {(title || headerActions) && (
          <div className="modal-header">
            {title && <h3>{title}</h3>}
            {headerActions}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
