import { useEffect, useState } from 'react'
import type { ShipmentCrudDto } from '../types/sim'
import { createShipment, deleteShipment, listShipments, updateShipment } from '../services/api'

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
    setForm(EMPTY_FORM)
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
    if (!id) {
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
          <button onClick={() => { resetForm(); setIsModalOpen(true) }}>Nuevo envio</button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="prep-overlay">Cargando envios...</div> : null}

      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Pedido</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Fecha</th>
              <th>Ingreso UTC</th>
              <th>Cantidad</th>
              <th>Cliente</th>
              <th>Asignado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id ?? item.codigoPedido}>
                <td>{item.id ?? '-'}</td>
                <td>{item.codigoPedido}</td>
                <td>{item.origen}</td>
                <td>{item.destino}</td>
                <td>{item.fecha}</td>
                <td>{item.ingresoUtc}</td>
                <td>{item.cantidad}</td>
                <td>{item.idCliente}</td>
                <td>{item.asignado ? 'Si' : 'No'}</td>
                <td className="crud-actions">
                  <button onClick={() => handleEdit(item)}>Editar</button>
                  <button onClick={() => handleDelete(item.id)} className="secondary">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="crud-pager">
        <button disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Anterior</button>
        <span>Página {page + 1} de {Math.max(1, totalPages)}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
      </div>

      {isModalOpen ? (
        <div className="crud-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="crud-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{form.id ? 'Editar envio' : 'Nuevo envio'}</h3>
            <div className="crud-form-grid">
              <label>
                Pedido
                <input value={form.codigoPedido} onChange={(event) => handleChange('codigoPedido', event.target.value)} />
              </label>
              <label>
                Origen
                <input value={form.origen} onChange={(event) => handleChange('origen', event.target.value)} />
              </label>
              <label>
                Destino
                <input value={form.destino} onChange={(event) => handleChange('destino', event.target.value)} />
              </label>
              <label>
                Fecha
                <input value={form.fecha} onChange={(event) => handleChange('fecha', event.target.value)} placeholder="AAAAMMDD" />
              </label>
              <label>
                Ingreso UTC
                <input type="datetime-local" value={form.ingresoUtc} onChange={(event) => handleChange('ingresoUtc', event.target.value)} />
              </label>
              <label>
                Ingreso local
                <input type="datetime-local" value={form.ingresoLocal} onChange={(event) => handleChange('ingresoLocal', event.target.value)} />
              </label>
              <label>
                GMT offset
                <input type="number" value={form.gmtOffset} onChange={(event) => handleChange('gmtOffset', Number(event.target.value))} />
              </label>
              <label>
                Día index
                <input type="number" value={form.diaIndex} onChange={(event) => handleChange('diaIndex', Number(event.target.value))} />
              </label>
              <label>
                Cantidad
                <input type="number" value={form.cantidad} onChange={(event) => handleChange('cantidad', Number(event.target.value))} />
              </label>
              <label>
                Cliente
                <input value={form.idCliente} onChange={(event) => handleChange('idCliente', event.target.value)} />
              </label>
              <label>
                SLA horas
                <input type="number" value={form.slaHoras} onChange={(event) => handleChange('slaHoras', Number(event.target.value))} />
              </label>
              <label>
                Asignado
                <input type="checkbox" checked={form.asignado} onChange={(event) => handleChange('asignado', event.target.checked)} />
              </label>
            </div>
            <div className="crud-actions">
              <button onClick={handleSubmit}>Guardar</button>
              <button className="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}