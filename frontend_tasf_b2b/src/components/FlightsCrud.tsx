import { useEffect, useState } from 'react'
import type { FlightCrudDto } from '../types/sim'
import { createFlight, deleteAllFlights, deleteFlight, listAirports, listFlights, updateFlight, uploadFlightsTxt } from '../services/api'
import type { AirportCrudDto } from '../types/sim'

export default function FlightsCrud() {
  const [items, setItems] = useState<FlightCrudDto[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)
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
  const [airports, setAirports] = useState<AirportCrudDto[]>([])
  const [airportsLoaded, setAirportsLoaded] = useState(false)
  const [activeOaciList, setActiveOaciList] = useState<'origen' | 'destino' | null>(null)
  const [form, setForm] = useState<FlightCrudDto>({
    codigo: '',
    origenOaci: '',
    destinoOaci: '',
    salida: '',
    llegada: '',
    capacidad: 150,
    cancelado: false,
  })
  const [capacidadText, setCapacidadText] = useState('150')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listFlights(page, 10, query)
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
    setForm({
      codigo: '',
      origenOaci: '',
      destinoOaci: '',
      salida: '',
      llegada: '',
      capacidad: 150,
      cancelado: false,
    })
    setCapacidadText('150')
  }

  const handleSubmit = async () => {
    setError(null)
    const capacidad = parseIntOrZero(capacidadText)
    if (capacidad === null) {
      setError('La capacidad debe ser un numero valido.')
      return
    }

    const payload: FlightCrudDto = {
      ...form,
      capacidad,
    }

    if (form.id) {
      await updateFlight(form.id, payload)
    } else {
      await createFlight(payload)
    }
    resetForm()
    setIsModalOpen(false)
    await load()
  }

  const handleEdit = (item: FlightCrudDto) => {
    setForm({ ...item })
    setCapacidadText(String(item.capacidad ?? 0))
    setIsModalOpen(true)
    void ensureAirports()
  }

  const handleDelete = async (id?: number) => {
    if (!id) {
      return
    }
    await deleteFlight(id)
    await load()
  }

  const openDeleteAllConfirm = () => {
    setIsDeleteAllConfirmOpen(true)
  }

  const cancelDeleteAll = () => {
    setIsDeleteAllConfirmOpen(false)
  }

  const handleDeleteAll = async () => {
    setIsDeleteAllConfirmOpen(false)
    setLoading(true)
    setError(null)
    try {
      await deleteAllFlights(true)
      setPage(0)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    resetForm()
    setIsModalOpen(true)
    void ensureAirports()
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
      const result = await uploadFlightsTxt(uploadFile)
      setUploadResult(result)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setUploadError(msg)
    } finally {
      setUploadLoading(false)
    }
  }

  const handleIntChange = (value: string, setter: (value: string) => void) => {
    if (/^-?\d*$/.test(value)) {
      setter(value)
    }
  }

  const parseIntOrZero = (value: string) => {
    if (value.trim() === '') {
      return 0
    }
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  const formatLocation = (codigo?: string, ciudad?: string) => {
    if (!codigo) {
      return '--'
    }
    return `${codigo}-${ciudad ?? '--'}`
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
    if (kind === 'origen') {
      setForm({ ...form, origenOaci: codigo })
    } else {
      setForm({ ...form, destinoOaci: codigo })
    }
    setActiveOaciList(null)
  }

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <h2>Vuelos</h2>
        <div className="crud-search">
          <input
            type="text"
            placeholder="Buscar por codigo u OACI"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </div>
        <button className="btn primary" onClick={handleNew}>Nuevo vuelo</button>
        {items.length > 0 ? (
          <button className="btn danger" onClick={openDeleteAllConfirm}>Eliminar todo</button>
        ) : null}
        <button className="btn ghost" onClick={() => setIsUploadOpen(true)}>Cargar TXT</button>
      </div>
      {error ? <div className="crud-error">{error}</div> : null}

      <div className="crud-table">
        <div className="crud-row flights header">
          <span>Codigo</span>
          <span>Origen</span>
          <span>Destino</span>
          <span>Salida</span>
          <span>Llegada</span>
          <span>Cap.</span>
          <span>Estado</span>
          <span></span>
        </div>
        {loading ? <div className="crud-empty">Cargando...</div> : null}
        {!loading && items.length === 0 ? <div className="crud-empty">Sin registros</div> : null}
        {items.map((item) => (
          <div className="crud-row flights" key={item.id}>
            <span>{item.codigo}</span>
            <span>{formatLocation(item.origenOaci, item.origenCiudad)}</span>
            <span>{formatLocation(item.destinoOaci, item.destinoCiudad)}</span>
            <span>{item.salida}</span>
            <span>{item.llegada}</span>
            <span>{item.capacidad}</span>
            <span>{item.cancelado ? 'Cancelado' : 'Activo'}</span>
            <div className="crud-row-actions">
              <button className="btn" onClick={() => handleEdit(item)}>Editar</button>
              <button className="btn" onClick={() => handleDelete(item.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <div className="crud-pagination">
        <button className="btn" disabled={page <= 0} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>{`${page + 1} / ${Math.max(1, totalPages)}`}</span>
        <button className="btn" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
          Siguiente
        </button>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? 'Editar vuelo' : 'Nuevo vuelo'}</h3>
              <button className="btn" onClick={() => setIsModalOpen(false)}>Cerrar</button>
            </div>
            <div className="modal-body">
              <label className="field">
                Codigo
                <input
                  type="text"
                  value={form.codigo}
                  onChange={(event) => setForm({ ...form, codigo: event.target.value })}
                />
              </label>
              <label className="field">
                Origen (OACI)
                <div className="oaci-field">
                  <input
                    type="text"
                    placeholder="Buscar OACI"
                    value={form.origenOaci}
                    onFocus={() => setActiveOaciList('origen')}
                    onChange={(event) => {
                      setForm({ ...form, origenOaci: event.target.value.toUpperCase() })
                      setActiveOaciList('origen')
                    }}
                    onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'origen' ? null : current)), 150)}
                  />
                  {activeOaciList === 'origen' ? (
                    <div className="oaci-list">
                      {getFilteredAirports(form.origenOaci).map((airport) => (
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
                    type="text"
                    placeholder="Buscar OACI"
                    value={form.destinoOaci}
                    onFocus={() => setActiveOaciList('destino')}
                    onChange={(event) => {
                      setForm({ ...form, destinoOaci: event.target.value.toUpperCase() })
                      setActiveOaciList('destino')
                    }}
                    onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'destino' ? null : current)), 150)}
                  />
                  {activeOaciList === 'destino' ? (
                    <div className="oaci-list">
                      {getFilteredAirports(form.destinoOaci).map((airport) => (
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
                Salida
                <input
                  type="datetime-local"
                  value={form.salida}
                  onChange={(event) => setForm({ ...form, salida: event.target.value })}
                />
              </label>
              <label className="field">
                Llegada
                <input
                  type="datetime-local"
                  value={form.llegada}
                  onChange={(event) => setForm({ ...form, llegada: event.target.value })}
                />
              </label>
              <label className="field">
                Capacidad
                <input
                  type="text"
                  inputMode="numeric"
                  value={capacidadText}
                  onChange={(event) => handleIntChange(event.target.value, setCapacidadText)}
                />
              </label>
              <label className="crud-checkbox">
                <input
                  type="checkbox"
                  checked={form.cancelado}
                  onChange={(event) => setForm({ ...form, cancelado: event.target.checked })}
                />
                Cancelado
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn primary" onClick={handleSubmit}>
                {form.id ? 'Actualizar' : 'Crear'}
              </button>
              <button className="btn" onClick={resetForm}>Limpiar</button>
            </div>
          </div>
        </div>
      ) : null}

      {isUploadOpen ? (
        <div className="modal-backdrop" onClick={closeUploadModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Cargar vuelos por TXT</h3>
              <button className="btn" onClick={closeUploadModal}>Cerrar</button>
            </div>
            <div className="modal-body">
              <div className="upload-card" style={{ boxShadow: 'none', padding: 0 }}>
                <h2>Archivo TXT de vuelos</h2>
                <p>Formato: ORIG-DEST-HH:MM-HH:MM-CAPACIDAD</p>
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
                  <span>{`Tamano: ${uploadFile ? (uploadFile.size / 1024).toFixed(2) : '0.00'} KB`}</span>
                </div>
                {uploadFile ? (
                  <div className="upload-note">Esto puede tardar unos minutos si el archivo contiene muchos vuelos.</div>
                ) : null}
                {uploadError ? <div className="upload-error">{uploadError}</div> : null}
                {uploadResult ? (
                  <div className={uploadResult.skipped === 0 ? 'upload-success' : 'upload-error'}>
                    <div>{`Total: ${uploadResult.total}. Insertados: ${uploadResult.inserted}. Actualizados: ${uploadResult.updated}. Omitidos: ${uploadResult.skipped}.`}</div>
                    {uploadResult.invalidAirportLines.length > 0 ? (
                      <div>
                        <div>Los siguientes registros referencian Aeropuertos que no existen:</div>
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
                  <button className="btn primary" onClick={handleUpload} disabled={uploadLoading}>
                    {uploadLoading ? 'Cargando...' : 'Cargar vuelos'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteAllConfirmOpen ? (
        <div className="modal-backdrop" onClick={cancelDeleteAll}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar eliminación</h3>
            </div>
            <div className="modal-body" style={{ gridTemplateColumns: '1fr' }}>
              <p>¿Desea eliminar todos los vuelos?</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={cancelDeleteAll}>Cancelar</button>
              <button className="btn danger" onClick={handleDeleteAll}>Aceptar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
