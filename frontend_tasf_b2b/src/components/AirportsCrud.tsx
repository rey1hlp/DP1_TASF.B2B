import { useEffect, useMemo, useState } from 'react'
import type { AirportCrudDto } from '../types/sim'
import { createAirport, deleteAirport, listAirports, updateAirport, uploadAirportsCsv } from '../services/api'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Pager from './ui/Pager'

export default function AirportsCrud() {
  const [items, setItems] = useState<AirportCrudDto[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
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
  const [allowContinentEdit, setAllowContinentEdit] = useState(false)
  const [form, setForm] = useState<AirportCrudDto>({
    codigoOaci: '',
    nombre: '',
    pais: '',
    ciudad: '',
    continente: '',
    gmt: 0,
    capacidad: 500,
    latitud: 0,
    longitud: 0,
  })
  const [gmtText, setGmtText] = useState('0')
  const [capacidadText, setCapacidadText] = useState('500')
  const [latitudText, setLatitudText] = useState('0')
  const [longitudText, setLongitudText] = useState('0')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listAirports(page, 10, query)
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
      codigoOaci: '',
      nombre: '',
      pais: '',
      ciudad: '',
      continente: '',
      gmt: 0,
      capacidad: 500,
      latitud: 0,
      longitud: 0,
    })
    setGmtText('0')
    setCapacidadText('500')
    setLatitudText('0')
    setLongitudText('0')
    setAllowContinentEdit(false)
  }

  const handleSubmit = async () => {
    setError(null)
    const gmt = parseIntOrZero(gmtText)
    const capacidad = parseIntOrZero(capacidadText)
    const latitud = parseFloatOrZero(latitudText)
    const longitud = parseFloatOrZero(longitudText)

    if (gmt === null || capacidad === null || latitud === null || longitud === null) {
      setError('Revisa los campos numericos. Usa solo numeros y decimales validos.')
      return
    }

    const payload: AirportCrudDto = {
      ...form,
      gmt,
      capacidad,
      latitud,
      longitud,
    }

    if (form.id) {
      await updateAirport(form.id, payload)
    } else {
      await createAirport(payload)
    }
    resetForm()
    setIsModalOpen(false)
    await load()
  }

  const handleEdit = (item: AirportCrudDto) => {
    setForm({ ...item })
    setGmtText(String(item.gmt ?? 0))
    setCapacidadText(String(item.capacidad ?? 0))
    setLatitudText(String(item.latitud ?? 0))
    setLongitudText(String(item.longitud ?? 0))
    setIsModalOpen(true)
  }

  const handleDelete = async (id?: number) => {
    if (!id) {
      return
    }
    await deleteAirport(id)
    await load()
  }

  const continentByCountry = useMemo(() => {
    const map: Record<string, string> = {
      peru: 'America',
      peruana: 'America',
      chile: 'America',
      argentina: 'America',
      brasil: 'America',
      bolivia: 'America',
      colombia: 'America',
      ecuador: 'America',
      venezuela: 'America',
      paraguay: 'America',
      uruguay: 'America',
      mexico: 'America',
      canada: 'America',
      "estados unidos": 'America',
      "united states": 'America',
      "united states of america": 'America',
      spain: 'Europa',
      espana: 'Europa',
      portugal: 'Europa',
      france: 'Europa',
      francia: 'Europa',
      germany: 'Europa',
      alemania: 'Europa',
      italy: 'Europa',
      italia: 'Europa',
      "reino unido": 'Europa',
      "united kingdom": 'Europa',
      ireland: 'Europa',
      irlanda: 'Europa',
      netherlands: 'Europa',
      holanda: 'Europa',
      "pais bajos": 'Europa',
      russia: 'Europa',
      rusia: 'Europa',
      china: 'Asia',
      japan: 'Asia',
      japon: 'Asia',
      india: 'Asia',
      "corea del sur": 'Asia',
      "korea": 'Asia',
      singapore: 'Asia',
      singapur: 'Asia',
      australia: 'Oceania',
      "nueva zelanda": 'Oceania',
    }
    return map
  }, [])

  const resolveContinent = (pais: string) => {
    const key = pais.trim().toLowerCase()
    return continentByCountry[key] ?? ''
  }

  const handleCountryChange = (value: string) => {
    const continent = resolveContinent(value)
    setForm({
      ...form,
      pais: value,
      continente: continent || form.continente,
    })
  }

  const handleNew = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const closeUploadModal = () => {
    setIsUploadOpen(false)
    setUploadFile(null)
    setUploadError(null)
    setUploadResult(null)
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Selecciona un archivo .csv')
      return
    }
    setUploadLoading(true)
    setUploadError(null)
    setUploadResult(null)
    try {
      const result = await uploadAirportsCsv(uploadFile)
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

  const handleDecimalChange = (value: string, setter: (value: string) => void) => {
    if (/^-?\d*(?:[.,]\d*)?$/.test(value)) {
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

  const parseFloatOrZero = (value: string) => {
    if (value.trim() === '') {
      return 0
    }
    const parsed = Number.parseFloat(value.replace(',', '.'))
    return Number.isNaN(parsed) ? null : parsed
  }

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <h2>Aeropuertos</h2>
        <div className="crud-search">
          <input
            type="text"
            placeholder="Buscar por OACI o nombre"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </div>
        <Button variant="primary" onClick={handleNew}>Nuevo aeropuerto</Button>
        <Button variant="ghost" onClick={() => setIsUploadOpen(true)}>Cargar CSV</Button>
      </div>
      {error ? <div className="crud-error">{error}</div> : null}

      <div className="crud-table">
        <div className="crud-row airports header">
          <span>OACI</span>
          <span>Nombre</span>
          <span>Pais</span>
          <span>GMT</span>
          <span>Capacidad</span>
          <span></span>
        </div>
        {loading ? <div className="crud-empty">Cargando...</div> : null}
        {!loading && items.length === 0 ? <div className="crud-empty">Sin registros</div> : null}
        {items.map((item) => (
          <div className="crud-row airports" key={item.id}>
            <span>{item.codigoOaci}</span>
            <span>{item.nombre}</span>
            <span>{item.pais}</span>
            <span>{item.gmt}</span>
            <span>{item.capacidad}</span>
            <div className="crud-row-actions">
              <Button onClick={() => handleEdit(item)}>Editar</Button>
              <Button variant="secondary" onClick={() => handleDelete(item.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>
      <Pager page={page} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(0, p - 1))} onNext={() => setPage((p) => p + 1)} />

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={form.id ? 'Editar aeropuerto' : 'Nuevo aeropuerto'}
        headerActions={<Button onClick={() => setIsModalOpen(false)}>Cerrar</Button>}
      >
        <div className="modal-body">
          <label className="field">
            Codigo OACI
            <input
              type="text"
              value={form.codigoOaci}
              onChange={(event) => setForm({ ...form, codigoOaci: event.target.value.toUpperCase() })}
            />
          </label>
          <label className="field">
            Nombre
            <input
              type="text"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            />
          </label>
          <label className="field">
            Pais
            <input
              type="text"
              value={form.pais}
              onChange={(event) => handleCountryChange(event.target.value)}
            />
          </label>
          <label className="field">
            Ciudad
            <input
              type="text"
              value={form.ciudad}
              onChange={(event) => setForm({ ...form, ciudad: event.target.value })}
            />
          </label>
          <label className="field">
            Continente
            <input
              type="text"
              value={form.continente}
              readOnly={!allowContinentEdit}
              onChange={(event) => setForm({ ...form, continente: event.target.value })}
            />
          </label>
          <label className="crud-checkbox">
            <input
              type="checkbox"
              checked={allowContinentEdit}
              onChange={(event) => setAllowContinentEdit(event.target.checked)}
            />
            Editar continente manualmente
          </label>
          <label className="field">
            GMT
            <input
              type="text"
              inputMode="numeric"
              value={gmtText}
              onChange={(event) => handleIntChange(event.target.value, setGmtText)}
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
          <label className="field">
            Latitud
            <input
              type="text"
              inputMode="decimal"
              value={latitudText}
              onChange={(event) => handleDecimalChange(event.target.value, setLatitudText)}
            />
          </label>
          <label className="field">
            Longitud
            <input
              type="text"
              inputMode="decimal"
              value={longitudText}
              onChange={(event) => handleDecimalChange(event.target.value, setLongitudText)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <Button variant="primary" onClick={handleSubmit}>
            {form.id ? 'Actualizar' : 'Crear'}
          </Button>
          <Button onClick={resetForm}>Limpiar</Button>
        </div>
      </Modal>

      <Modal open={isUploadOpen} onClose={closeUploadModal} title="Cargar aeropuertos por CSV" headerActions={<Button onClick={closeUploadModal}>Cerrar</Button>}>
        <div className="modal-body">
          <div className="upload-card" style={{ boxShadow: 'none', padding: 0 }}>
            <h2>Archivo CSV de aeropuertos</h2>
            <p>Usa columnas: codigo_oaci,nombre,pais,ciudad,continente,gmt,capacidad,latitud,longitud</p>
            <div className="upload-actions">
              <label className="btn ghost">
                Seleccionar archivo
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  hidden
                />
              </label>
            </div>
            <div className="upload-summary">
              <span>{`Archivo: ${uploadFile ? uploadFile.name : 'Ninguno'}`}</span>
              <span>{`Tamano: ${uploadFile ? (uploadFile.size / 1024).toFixed(2) : '0.00'} KB`}</span>
            </div>
            {uploadError ? <div className="upload-error">{uploadError}</div> : null}
            {uploadResult ? (
              <div className={uploadResult.skipped === 0 ? 'upload-success' : 'upload-error'}>
                <div>{`Total: ${uploadResult.total}. Insertados: ${uploadResult.inserted}. Actualizados: ${uploadResult.updated}. Omitidos: ${uploadResult.skipped}.`}</div>
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
                {uploadLoading ? 'Cargando...' : 'Cargar aeropuertos'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
