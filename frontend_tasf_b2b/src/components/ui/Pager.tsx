import React from 'react'
import Button from './Button'

type PagerProps = {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

export default function Pager({ page, totalPages, onPrev, onNext }: PagerProps) {
  return (
    <div className="crud-pager">
      <Button variant="default" onClick={onPrev} disabled={page <= 0}>
        Anterior
      </Button>
      <span>Página {page + 1} de {Math.max(1, totalPages)}</span>
      <Button variant="default" onClick={onNext} disabled={page + 1 >= totalPages}>
        Siguiente
      </Button>
    </div>
  )
}
