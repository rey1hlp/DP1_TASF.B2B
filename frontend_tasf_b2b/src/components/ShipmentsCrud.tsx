import { useEffect, useState } from 'react'
import type { ShipmentCrudDto } from '../types/sim'
import { createShipment, deleteShipment, listShipments, updateShipment } from '../services/api'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Pager from './ui/Pager'

const EMPTY_FORM: ShipmentCrudDto = {
  codigoPedido: '',
  origen: '',
  destino: '',
  fecha: '',
  diaIndex: 0,
  ingresoUtc: '',
  ingresoLocal: '',
  gmtOffset: 0,
  cantidad: 1,
  idCliente: '',
  slaHoras: 24,
  asignado: false,
}

export default function ShipmentsCrud() {
  const [items, setItems] = useState<ShipmentCrudDto[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<ShipmentCrudDto>(EMPTY_FORM)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listShipments(page, 10, query)
      setItems(result.content)
      setTotalPages(result.totalPages)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, query])

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
  }

  const handleSubmit = async () => {
    setError(null)
    if (!form.codigoPedido || !form.origen || !form.destino || !form.fecha || !form.ingresoUtc || !form.ingresoLocal || !form.idCliente) {
      setError('Completa los campos requeridos.')
      return
    }

    const payload: ShipmentCrudDto = {
      ...form,
      origen: form.origen.trim().toUpperCase(),
      destino: form.destino.trim().toUpperCase(),
      codigoPedido: form.codigoPedido.trim(),
      idCliente: form.idCliente.trim(),
      fecha: form.fecha.trim(),
    }

    if (form.id) {
      await updateShipment(form.id, payload)
    } else {
      await createShipment(payload)
    }

    resetForm()
    setIsModalOpen(false)
    await load()
  }

  const handleEdit = (item: ShipmentCrudDto) => {
    setForm({ ...item })
    setIsModalOpen(true)
  }

  const handleDelete = async (id?: number) => {
    if (id == null) {
      return
    }
    await deleteShipment(id)
    await load()
  }

  const handleChange = (key: keyof ShipmentCrudDto, value: string | number | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="crud-panel">
        <div className="crud-header">
        <h2>Envios</h2>
        <div className="crud-search">
          <input
            type="text"
            placeholder="Buscar por pedido, origen o destino"
            value={query}
            onChange={(event) => {
              setPage(0)
              setQuery(event.target.value)
            }}
          />
          <Button variant="primary" onClick={() => { resetForm(); setIsModalOpen(true) }}>Nuevo envio</Button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="prep-overlay">Cargando envios...</div> : null}

      <div className="crud-table">
        <div className="crud-row shipments header">
          <span>Pedido</span>
          <span>Origen</span>
          <span>Destino</span>
          <span>Fecha Ingreso UTC</span>
          <span>Cantidad</span>
          <span>Cliente</span>
          <span></span>
        </div>
        {loading ? <div className="crud-empty">Cargando envios...</div> : null}
        {!loading && items.length === 0 ? <div className="crud-empty">Sin registros</div> : null}
        {items.map((item) => (
          <div className="crud-row shipments" key={item.id ?? item.codigoPedido}>
            <span>{item.codigoPedido}</span>
            <span>{item.origen}</span>
            <span>{item.destino}</span>
            <span>{item.ingresoUtc}</span>
            <span>{item.cantidad}</span>
            <span>{item.idCliente}</span>
            <div className="crud-row-actions">
              <Button onClick={() => handleEdit(item)}>Editar</Button>
              <Button variant="secondary" onClick={() => handleDelete(item.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPrev={() => setPage((current) => Math.max(0, current - 1))} onNext={() => setPage((current) => current + 1)} />

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={form.id ? 'Editar envio' : 'Nuevo envio'}>
        <div className="crud-form-grid">
          <label className="field">
            Pedido
            <input value={form.codigoPedido} onChange={(event) => handleChange('codigoPedido', event.target.value)} />
          </label>
          <label className="field">
            Origen
            <input value={form.origen} onChange={(event) => handleChange('origen', event.target.value)} />
          </label>
          <label className="field">
            Destino
            <input value={form.destino} onChange={(event) => handleChange('destino', event.target.value)} />
          </label>
          <label className="field">
            Fecha
            <input value={form.fecha} onChange={(event) => handleChange('fecha', event.target.value)} placeholder="AAAAMMDD" />
          </label>
          <label className="field">
            Ingreso local
            <input type="datetime-local" value={form.ingresoLocal} onChange={(event) => handleChange('ingresoLocal', event.target.value)} />
          </label>
          <label className="field">
            Cantidad
            <input type="number" value={form.cantidad} onChange={(event) => handleChange('cantidad', Number(event.target.value))} />
          </label>
          <label className="field">
            Cliente
            <input value={form.idCliente} onChange={(event) => handleChange('idCliente', event.target.value)} />
          </label>
        </div>
        <div className="crud-actions">
          <Button variant="primary" onClick={handleSubmit}>Guardar</Button>
          <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
        </div>
      </Modal>
    </div>
  )
}