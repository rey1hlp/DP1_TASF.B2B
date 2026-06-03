import React from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  headerActions?: React.ReactNode
  children?: React.ReactNode
}

export default function Modal({ open, onClose, title, headerActions, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
