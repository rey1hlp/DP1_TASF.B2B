import { useEffect, useMemo, useState } from 'react'
import type { AirportCrudDto, ShipmentCrudDto } from '../types/sim'
import { createShipment, deleteShipment, getAirportByCode, listAirports, listShipments, updateShipment, uploadShipmentsTxt } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Pager from './ui/Pager'
import { formatFileSize, formatInteger, formatUtcDateTimeForClock } from '../utils/time'

const EMPTY_FORM: ShipmentCrudDto = {
  codigoPedido: '',
  origen: '',
  destino: '',
  fecha: '',
  diaIndex: 0,
  ingresoUtc: '',
  ingresoLocal: '',
  origenGmt: 0,
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

function toDatetimeLocalFromGmt(gmt: number): string {
  const local = new Date(Date.now() + gmt * 60 * 60 * 1000)
  const yyyy = local.getUTCFullYear()
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(local.getUTCDate()).padStart(2, '0')
  const hh = String(local.getUTCHours()).padStart(2, '0')
  const min = String(local.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function datePart(value?: string | null): string {
  return value ? value.substring(0, 10) : ''
}

function timePart(value?: string | null): string {
  return value && value.includes('T') ? value.substring(11, 16) : ''
}

function normalizeShipmentCode(value?: string | null): string {
  return value?.trim().toUpperCase() ?? ''
}

function extractOriginFromTxtFileName(filename?: string | null): string | null {
  if (!filename) {
    return null
  }
  const match = filename.match(/_envios_([A-Za-z0-9]{4})_/i)
  return match?.[1] ? normalizeShipmentCode(match[1]) : null
}

function buildImportedShipmentCode(originOaci: string, rawCode: string): string {
  const normalizedOrigin = normalizeShipmentCode(originOaci)
  const normalizedRawCode = normalizeShipmentCode(rawCode)
  if (normalizedRawCode.startsWith(normalizedOrigin)) {
    return normalizedRawCode
  }
  return `${normalizedOrigin}${normalizedRawCode}`
}

function extractShipmentCodesFromTxt(content: string, originOaci: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sanitized = line.replace(/^\uFEFF/, '')
      const separatorIndex = sanitized.indexOf('-')
      const rawCode = separatorIndex >= 0 ? sanitized.slice(0, separatorIndex).trim() : sanitized.trim()
      return buildImportedShipmentCode(originOaci, rawCode)
    })
    .filter(Boolean)
}

export default function ShipmentsCrud() {
  const { user } = useAuth()
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
  const [isDuplicateErrorOpen, setIsDuplicateErrorOpen] = useState(false)
  const [duplicateUploadCodes, setDuplicateUploadCodes] = useState<string[]>([])
  const [shipmentCodeNotice, setShipmentCodeNotice] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    total: number
    inserted: number
    updated: number
    skipped: number
    invalidFormatLines: string[]
    invalidAirportLines: string[]
  } | null>(null)

  const logisticsAirportCode = user && user.role !== 'ADMIN'
    ? user.airportCode?.trim().toUpperCase() ?? null
    : null

  const logisticsAirport = useMemo(() => {
    if (!logisticsAirportCode) {
      return null
    }
    return airports.find((airport) => airport.codigoOaci.toUpperCase() === logisticsAirportCode) ?? null
  }, [airports, logisticsAirportCode])

  const isOriginLocked = Boolean(logisticsAirportCode)
  const accountClockGmt = logisticsAirportCode ? logisticsAirport?.gmt ?? null : null

  const formatShipmentIngress = (item: ShipmentCrudDto): string => {
    const gmt = accountClockGmt ?? (logisticsAirportCode ? item.origenGmt : null)
    return formatUtcDateTimeForClock(item.ingresoUtc || item.ingresoLocal, gmt)
  }

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

  const buildEmptyForm = (airport: AirportCrudDto | null = logisticsAirport): ShipmentCrudDto => ({
    ...EMPTY_FORM,
    origen: logisticsAirportCode ?? '',
    origenGmt: airport?.gmt ?? EMPTY_FORM.origenGmt,
    ingresoLocal: airport ? toDatetimeLocalFromGmt(airport.gmt) : '',
  })

  const resetForm = () => {
    setForm(buildEmptyForm())
  }

  const ensureAirports = async (): Promise<AirportCrudDto[]> => {
    if (airportsLoaded) {
      return airports
    }
    try {
      const result = await listAirports(0, 1000, '')
      setAirports(result.content)
      setAirportsLoaded(true)
      return result.content
    } catch {
      setAirports([])
      return []
    }
  }

  const loadLogisticsAirport = async (knownAirports: AirportCrudDto[] = airports): Promise<AirportCrudDto | null> => {
    if (!logisticsAirportCode) {
      return null
    }

    const knownAirport = knownAirports.find((airport) => airport.codigoOaci.toUpperCase() === logisticsAirportCode)
    if (knownAirport) {
      return knownAirport
    }

    try {
      const airport = await getAirportByCode(logisticsAirportCode)
      setAirports((current) => {
        const exists = current.some((item) => item.codigoOaci.toUpperCase() === airport.codigoOaci.toUpperCase())
        return exists
          ? current.map((item) => item.codigoOaci.toUpperCase() === airport.codigoOaci.toUpperCase() ? airport : item)
          : [...current, airport]
      })
      return airport
    } catch {
      return null
    }
  }

  const loadAllVisibleShipmentCodes = async (): Promise<Set<string>> => {
    const codes = new Set<string>()
    const pageSize = 500
    let currentPage = 0
    let totalPages = 1

    while (currentPage < totalPages) {
      const result = await listShipments(currentPage, pageSize, '')
      result.content.forEach((item) => {
        const code = normalizeShipmentCode(item.codigoPedido)
        if (code) {
          codes.add(code)
        }
      })
      totalPages = Math.max(result.totalPages, currentPage + 1)
      currentPage += 1
    }

    return codes
  }

  useEffect(() => {
    if (!isModalOpen || !logisticsAirportCode) {
      return
    }

    setActiveOaciList((current) => (current === 'origen' ? null : current))
    setForm((current) => {
      const nextGmt = logisticsAirport?.gmt ?? current.origenGmt
      if (current.origen === logisticsAirportCode && current.origenGmt === nextGmt) {
        return current
      }
      return {
        ...current,
        origen: logisticsAirportCode,
        origenGmt: nextGmt,
        ingresoLocal: toDatetimeLocalFromGmt(nextGmt),
      }
    })
  }, [isModalOpen, logisticsAirport?.gmt, logisticsAirportCode])

  useEffect(() => {
    if (!isModalOpen || !logisticsAirportCode || logisticsAirport) {
      return
    }
    void loadLogisticsAirport()
  }, [isModalOpen, logisticsAirport, logisticsAirportCode])

  useEffect(() => {
    if (!logisticsAirportCode || logisticsAirport) {
      return
    }
    void loadLogisticsAirport()
  }, [logisticsAirport, logisticsAirportCode])

  const handleSubmit = async () => {
    setError(null)
    console.debug('[ShipmentsCrud] submit start', { form })
    if (!form.origen || !form.destino || !form.ingresoLocal || !form.idCliente) {
      setError('Completa los campos requeridos.')
      return
    }

    const payload: ShipmentCrudDto = {
      ...form,
      origen: (logisticsAirportCode ?? form.origen).trim().toUpperCase(),
      destino: form.destino.trim().toUpperCase(),
      codigoPedido: form.codigoPedido.trim(),
      idCliente: form.idCliente.trim(),
    }
    console.debug('[ShipmentsCrud] payload', payload)

    if (form.id) {
      console.debug('[ShipmentsCrud] updateShipment', { id: form.id })
      await updateShipment(form.id, payload)
    } else {
      console.debug('[ShipmentsCrud] createShipment')
      const created = await createShipment(payload)
      setShipmentCodeNotice(created.codigoPedido)
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

  const closeDuplicateErrorModal = () => {
    setIsDuplicateErrorOpen(false)
    setDuplicateUploadCodes([])
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Selecciona un archivo .txt')
      return
    }

    // --- NUEVA VALIDACIÓN DE ROL POR NOMBRE DE ARCHIVO ---
    if (logisticsAirportCode) {
      const expectedFileName = `_envios_${logisticsAirportCode}_.txt`.toLowerCase();
      if (uploadFile.name.toLowerCase() !== expectedFileName) {
        setUploadError(`Permiso denegado. Solo puedes cargar el archivo de tu aeropuerto asignado: _envios_${logisticsAirportCode}_.txt`);
        return;
      }
    }

    const originOaci = extractOriginFromTxtFileName(uploadFile.name)
    if (!originOaci) {
      setUploadError('No se pudo identificar el aeropuerto origen a partir del nombre del archivo.')
      return
    }

    let duplicateCodes: string[] = []
    try {
      const fileContent = await uploadFile.text()
      const fileCodes = extractShipmentCodesFromTxt(fileContent, originOaci)
      const currentCodes = await loadAllVisibleShipmentCodes()
      duplicateCodes = [...new Set(
        fileCodes.filter((code) => currentCodes.has(normalizeShipmentCode(code))),
      )].sort((left, right) => left.localeCompare(right))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setUploadError(`No se pudo validar duplicados antes de cargar el TXT: ${msg}`)
      return
    }

    if (duplicateCodes.length > 0) {
      setUploadError(null)
      setUploadResult(null)
      setDuplicateUploadCodes(duplicateCodes)
      setIsDuplicateErrorOpen(true)
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

  const handleNew = async () => {
    setIsModalOpen(true)
    const loadedAirports = await ensureAirports()
    const currentLogisticsAirport = await loadLogisticsAirport(loadedAirports)
    setForm(buildEmptyForm(currentLogisticsAirport))
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
    setForm((current) => {
      const airport = airports.find((item) => item.codigoOaci.toUpperCase() === codigo.toUpperCase())
      return {
        ...current,
        [kind]: codigo,
        ...(kind === 'origen'
          ? {
            origenGmt: airport?.gmt ?? current.origenGmt,
            ingresoLocal: airport ? toDatetimeLocalFromGmt(airport.gmt) : current.ingresoLocal,
          }
          : {}),
      }
    })
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
          <span>Fecha de Ingreso Local</span>
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
            <span>{formatShipmentIngress(item)}</span>
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
            <p>Formato: 000000001-AAAAMMDD-HH-MM-DESTINO-CANTIDAD-IDCLIENTE</p>
            <p>El sistema generara el identificador final como OACI de origen + 9 digitos del archivo.</p>

            {logisticsAirportCode ? (
              <p>
                Nombre requerido para tu usuario: <strong><code>_envios_{logisticsAirportCode}_.txt</code></strong>
                <br />
                <small style={{ color: '#6c757d' }}>Como registrador, solo tienes permisos para cargar envíos de tu aeropuerto asignado.</small>
              </p>
            ) : (
              <p>Nombre requerido: <code>_envios_OACI_.txt</code>, por ejemplo <code>_envios_EBCI_.txt</code></p>
            )}
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

      <Modal
        open={isDuplicateErrorOpen}
        onClose={closeDuplicateErrorModal}
        title="Carga de envios bloqueada"
        className="modal--compact"
      >
        <div className="duplicate-upload-modal">
          <div className="duplicate-upload-modal__message">
            {`Error: Los siguientes pedidos ya se encuentran registrados en el sistema: [${duplicateUploadCodes.join(', ')}]. Por favor, corrÃ­jalos antes de volver a intentar.`}
          </div>
          <div className="duplicate-upload-modal__codes">
            {duplicateUploadCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <div className="modal-actions">
            <Button variant="primary" onClick={closeDuplicateErrorModal}>Entendido</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={shipmentCodeNotice != null}
        onClose={() => setShipmentCodeNotice(null)}
        title="Envio registrado"
        className="modal--compact"
      >
        <div className="shipment-code-notice">
          <div className="shipment-code-notice__message">
            {`Se registro el envio con el identificador ${shipmentCodeNotice ?? ''}.`}
          </div>
          <div className="shipment-code-notice__codes">
            <code>{shipmentCodeNotice ?? ''}</code>
          </div>
          <div className="modal-actions">
            <Button variant="primary" onClick={() => setShipmentCodeNotice(null)}>Entendido</Button>
          </div>
        </div>
      </Modal>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={form.id ? 'Editar envio' : 'Nuevo envio'}>
        <div className="crud-form-grid">
          <label className="field">
            Origen (OACI)
            <div className="oaci-field">
              <input
                value={form.origen}
                placeholder="Buscar OACI"
                disabled={isOriginLocked}
                title={isOriginLocked ? 'Origen asignado por tu aeropuerto' : undefined}
                onFocus={() => {
                  if (!isOriginLocked) setActiveOaciList('origen')
                }}
                onChange={(event) => {
                  if (isOriginLocked) return
                  handleChange('origen', event.target.value.toUpperCase())
                  setActiveOaciList('origen')
                }}
                onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'origen' ? null : current)), 150)}
              />
              {activeOaciList === 'origen' && !isOriginLocked ? (
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
            Fecha ingreso
            <input
              type="date"
              value={datePart(form.ingresoLocal)}
              disabled
              title="Fecha local derivada del aeropuerto origen"
            />
          </label>
          <label className="field">
            Hora ingreso
            <input
              type="time"
              value={timePart(form.ingresoLocal)}
              disabled
              title="Hora local derivada del aeropuerto origen"
            />
          </label>
          <label className="field">
            GMT origen
            <input
              value={`GMT${form.origenGmt >= 0 ? '+' : ''}${form.origenGmt}`}
              disabled
              title="GMT derivado del aeropuerto origen"
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
