import { useEffect, useState } from 'react'
import type { AirportCrudDto, ShipmentCrudDto } from '../types/sim'
import { createShipment, deleteShipment, listAirports, listShipments, updateShipment, uploadShipmentsTxt } from '../services/api'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Pager from './ui/Pager'
import { formatDate, formatDateTime, formatFileSize, formatInteger } from '../utils/time'

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

function getShipmentStatusLabel(status?: ShipmentCrudDto['status']) {
  if (status === 'ASSIGNED') return 'Asignado'
  if (status === 'IN_TRANSIT') return 'En tránsito'
  if (status === 'DELIVERED') return 'Entregado'
  if (status === 'CANCELLED') return 'Cancelado'
  return 'Pendiente'
}

function getShipmentStatusClass(status?: ShipmentCrudDto['status']) {
  if (status === 'ASSIGNED') return 'assigned'
  if (status === 'IN_TRANSIT') return 'in-transit'
  if (status === 'DELIVERED') return 'delivered'
  if (status === 'CANCELLED') return 'cancelled'
  return 'pending'
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
  const [airports, setAirports] = useState<AirportCrudDto[]>([])
  const [airportsLoaded, setAirportsLoaded] = useState(false)
  const [activeOaciList, setActiveOaciList] = useState<'origen' | 'destino' | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    total: number
    inserted: number
    updated: number
    skipped: number
    invalidFormatLines: string[]
    invalidAirportLines: string[]
  } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    console.debug('[ShipmentsCrud] load', { page, query })
    try {
      const result = await listShipments(page, 10, query)
      console.debug('[ShipmentsCrud] load result', result)
      setItems(result.content)
      setTotalPages(result.totalPages)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      console.error('[ShipmentsCrud] load failed', err)
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

  const ensureAirports = async () => {
    if (airportsLoaded) {
      return
    }
    try {
      const result = await listAirports(0, 1000, '')
      setAirports(result.content)
      setAirportsLoaded(true)
    } catch {
      setAirports([])
    }
  }

  const computeIngresoUtc = (ingresoLocal: string, gmtOffset: number) => {
    if (!ingresoLocal) {
      return ''
    }
    const match = ingresoLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!match) {
      return ''
    }
    const [, year, month, day, hour, minute] = match
    const utcMillis = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - gmtOffset,
      Number(minute),
      0,
      0
    )
    return new Date(utcMillis).toISOString().slice(0, 16)
  }

  const normalizeFecha = (fecha: string, ingresoLocal: string) => {
    const digits = fecha.trim().replaceAll('-', '')
    if (/^\d{8}$/.test(digits)) {
      return digits
    }
    return ingresoLocal.slice(0, 10).replaceAll('-', '')
  }

  const handleSubmit = async () => {
    setError(null)
    console.debug('[ShipmentsCrud] submit start', { form })
    if (!form.codigoPedido || !form.origen || !form.destino || !form.fecha || !form.ingresoLocal || !form.idCliente) {
      setError('Completa los campos requeridos.')
      return
    }

    const ingresoUtc = computeIngresoUtc(form.ingresoLocal, form.gmtOffset)
    console.debug('[ShipmentsCrud] computed ingresoUtc', { ingresoUtc, ingresoLocal: form.ingresoLocal, gmtOffset: form.gmtOffset })
    if (!ingresoUtc) {
      setError('Ingresa una fecha local valida para calcular UTC.')
      return
    }

    const payload: ShipmentCrudDto = {
      ...form,
      origen: form.origen.trim().toUpperCase(),
      destino: form.destino.trim().toUpperCase(),
      codigoPedido: form.codigoPedido.trim(),
      idCliente: form.idCliente.trim(),
      fecha: normalizeFecha(form.fecha, form.ingresoLocal),
      ingresoUtc,
    }
    console.debug('[ShipmentsCrud] payload', payload)

    if (form.id) {
      console.debug('[ShipmentsCrud] updateShipment', { id: form.id })
      await updateShipment(form.id, payload)
    } else {
      console.debug('[ShipmentsCrud] createShipment')
      await createShipment(payload)
    }

    resetForm()
    setIsModalOpen(false)
    console.debug('[ShipmentsCrud] submit done, reloading list')
    await load()
  }

  const handleEdit = (item: ShipmentCrudDto) => {
    setForm({ ...item })
    setIsModalOpen(true)
    void ensureAirports()
  }

  const handleDelete = async (id?: number) => {
    if (id == null) {
      return
    }
    console.debug('[ShipmentsCrud] deleteShipment', { id })
    await deleteShipment(id)
    await load()
  }

  const closeUploadModal = () => {
    setIsUploadOpen(false)
    setUploadFile(null)
    setUploadError(null)
    setUploadResult(null)
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Selecciona un archivo .txt')
      return
    }

    setUploadLoading(true)
    setUploadError(null)
    setUploadResult(null)
    try {
      const result = await uploadShipmentsTxt(uploadFile)
      setUploadResult(result)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setUploadError(msg)
    } finally {
      setUploadLoading(false)
    }
  }

  const handleChange = (key: keyof ShipmentCrudDto, value: string | number | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleNew = () => {
    resetForm()
    setIsModalOpen(true)
    void ensureAirports()
  }

  const getFilteredAirports = (value: string) => {
    const query = value.trim().toLowerCase()
    if (!query) {
      return airports
    }
    return airports.filter((airport) => {
      const nombre = airport.nombre.toLowerCase()
      const ciudad = (airport.ciudad ?? '').toLowerCase()
      const codigo = airport.codigoOaci.toLowerCase()
      return codigo.includes(query) || nombre.includes(query) || ciudad.includes(query)
    })
  }

  const handleSelectAirport = (kind: 'origen' | 'destino', codigo: string) => {
    setForm((current) => ({ ...current, [kind]: codigo }))
    setActiveOaciList(null)
  }

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <div className="crud-header-main">
          <h2>Envios</h2>
        </div>
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
        </div>
        <div className="crud-header-actions">
          <Button variant="primary" onClick={handleNew}>Nuevo envio</Button>
          <Button variant="ghost" onClick={() => setIsUploadOpen(true)}>Cargar TXT</Button>
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
          <span className="shipment-status-header">Estado</span>
          <span></span>
        </div>
        {loading ? <div className="crud-empty">Cargando envios...</div> : null}
        {!loading && items.length === 0 ? <div className="crud-empty">Sin registros</div> : null}
        {items.map((item) => (
          <div className="crud-row shipments" key={item.id ?? item.codigoPedido}>
            <span>{item.codigoPedido}</span>
            <span>{item.origen}</span>
            <span>{item.destino}</span>
            <span>{formatDateTime(item.ingresoUtc)}</span>
            <span>{formatInteger(item.cantidad)}</span>
            <span>{item.idCliente}</span>
            <span className={`status-badge ${getShipmentStatusClass(item.status)}`}>
              {getShipmentStatusLabel(item.status)}
            </span>
            <div className="crud-row-actions">
              <Button onClick={() => handleEdit(item)}>Editar</Button>
              <Button variant="secondary" onClick={() => handleDelete(item.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPrev={() => setPage((current) => Math.max(0, current - 1))} onNext={() => setPage((current) => current + 1)} />

      <Modal open={isUploadOpen} onClose={closeUploadModal} title="Cargar envios por TXT" headerActions={<Button onClick={closeUploadModal}>Cerrar</Button>}>
        <div className="modal-body">
          <div className="upload-card" style={{ boxShadow: 'none', padding: 0 }}>
            <h2>Archivo TXT de envios</h2>
            <p>Formato: codigoPedido-AAAAMMDD-HH-MM-DESTINO-CANTIDAD-IDCLIENTE</p>
            <p>Nombre requerido: <code>_envios_OACI_.txt</code>, por ejemplo <code>_envios_EBCI_.txt</code></p>
            <div className="upload-actions">
              <label className="btn ghost">
                Seleccionar archivo
                <input
                  type="file"
                  accept=".txt"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  hidden
                />
              </label>
            </div>
            <div className="upload-summary">
              <span>{`Archivo: ${uploadFile ? uploadFile.name : 'Ninguno'}`}</span>
              <span>{`Tamano: ${formatFileSize(uploadFile?.size ?? 0)}`}</span>
            </div>
            {uploadError ? <div className="upload-error">{uploadError}</div> : null}
            {uploadResult ? (
              <div className={uploadResult.skipped === 0 ? 'upload-success' : 'upload-error'}>
                <div>{`Total: ${formatInteger(uploadResult.total)}. Insertados: ${formatInteger(uploadResult.inserted)}. Actualizados: ${formatInteger(uploadResult.updated)}. Omitidos: ${formatInteger(uploadResult.skipped)}.`}</div>
                {uploadResult.invalidAirportLines.length > 0 ? (
                  <div>
                    <div>Los siguientes registros referencian aeropuertos que no existen:</div>
                    <pre className="upload-list">{uploadResult.invalidAirportLines.join('\n')}</pre>
                  </div>
                ) : null}
                {uploadResult.invalidFormatLines.length > 0 ? (
                  <div>
                    <div>Los siguientes registros no siguen el formato correcto:</div>
                    <pre className="upload-list">{uploadResult.invalidFormatLines.join('\n')}</pre>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="upload-footer">
              <Button variant="primary" onClick={handleUpload} disabled={uploadLoading}>
                {uploadLoading ? 'Cargando...' : 'Cargar envios'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={form.id ? 'Editar envio' : 'Nuevo envio'}>
        <div className="crud-form-grid">
          <label className="field">
            Pedido
            <input value={form.codigoPedido} onChange={(event) => handleChange('codigoPedido', event.target.value)} />
          </label>
          <label className="field">
            Origen (OACI)
            <div className="oaci-field">
              <input
                value={form.origen}
                placeholder="Buscar OACI"
                onFocus={() => setActiveOaciList('origen')}
                onChange={(event) => {
                  handleChange('origen', event.target.value.toUpperCase())
                  setActiveOaciList('origen')
                }}
                onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'origen' ? null : current)), 150)}
              />
              {activeOaciList === 'origen' ? (
                <div className="oaci-list">
                  {getFilteredAirports(form.origen).map((airport) => (
                    <button
                      key={airport.codigoOaci}
                      type="button"
                      className="oaci-option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectAirport('origen', airport.codigoOaci)}
                    >
                      <span className="oaci-code">{airport.codigoOaci}</span>
                      <span className="oaci-name">{airport.ciudad ?? airport.nombre}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field">
            Destino (OACI)
            <div className="oaci-field">
              <input
                value={form.destino}
                placeholder="Buscar OACI"
                onFocus={() => setActiveOaciList('destino')}
                onChange={(event) => {
                  handleChange('destino', event.target.value.toUpperCase())
                  setActiveOaciList('destino')
                }}
                onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'destino' ? null : current)), 150)}
              />
              {activeOaciList === 'destino' ? (
                <div className="oaci-list">
                  {getFilteredAirports(form.destino).map((airport) => (
                    <button
                      key={airport.codigoOaci}
                      type="button"
                      className="oaci-option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectAirport('destino', airport.codigoOaci)}
                    >
                      <span className="oaci-code">{airport.codigoOaci}</span>
                      <span className="oaci-name">{airport.ciudad ?? airport.nombre}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="field">
            Fecha
            <input value={form.fecha} onChange={(event) => handleChange('fecha', event.target.value)} placeholder="AAAAMMDD" title={formatDate(form.fecha)} />
          </label>
          <label className="field">
            Ingreso local
            <input type="datetime-local" value={form.ingresoLocal} onChange={(event) => handleChange('ingresoLocal', event.target.value)} />
          </label>
          <label className="field">
            GMT offset
            <input
              type="number"
              value={form.gmtOffset}
              onChange={(event) => handleChange('gmtOffset', Number(event.target.value))}
            />
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
