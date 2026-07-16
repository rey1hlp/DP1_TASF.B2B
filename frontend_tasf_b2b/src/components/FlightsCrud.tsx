import { useEffect, useMemo, useState } from 'react'
import type { FlightCrudDto } from '../types/sim'
import { cancelFlightDay, createFlight, deleteFlight, listAirports, listFlights, updateFlight, uploadFlightsTxt } from '../services/api'
import type { AirportCrudDto } from '../types/sim'
import { useSimulationContext } from '../contexts/SimulationContext'
import { formatFileSize, formatGmtOffset, formatInteger, formatIsoDateFromDayIndex } from '../utils/time'
import { appendCancelledFlightDay } from '../utils/cancelledFlightTraces'

interface FlightsCrudProps {
  onViewDetail: (id: number) => void;
}

export default function FlightsCrud({ onViewDetail }: FlightsCrudProps) {
  const { simulation, currentMinute, status } = useSimulationContext()
  const [items, setItems] = useState<FlightCrudDto[]>([])
  const query = ''
  const [filterOrigen, setFilterOrigen] = useState('')
  const [filterDestino, setFilterDestino] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [allItems, setAllItems] = useState<FlightCrudDto[]>([])
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
  const [airports, setAirports] = useState<AirportCrudDto[]>([])
  const [airportsLoaded, setAirportsLoaded] = useState(false)
  const [dayCancelLoadingId, setDayCancelLoadingId] = useState<number | null>(null)

  const [activeOaciList, setActiveOaciList] = useState<'origen' | 'destino' | null>(null)
  const [form, setForm] = useState<FlightCrudDto>({
	    codigo: '',
	    origenOaci: '',
	    destinoOaci: '',
	    salidaLocal: '',
	    llegadaLocal: '',
	    salidaUtcOffsetMin: 0,
	    duracionMin: 0,
	    origenGmt: 0,
	    destinoGmt: 0,
	    capacidad: 150,
    cancelado: false,
  })
  const [capacidadText, setCapacidadText] = useState('150')
  const [flightCodeSuffix, setFlightCodeSuffix] = useState('')

  const hasActiveFilters = filterOrigen || filterDestino

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (hasActiveFilters) {
        const result = await listFlights(0, 1000, query)
        setAllItems(result.content)
        setItems(result.content)
        setPage(0)
      } else {
        const result = await listFlights(page, 10, query)
        setItems(result.content)
        setAllItems([])
        setTotalPages(result.totalPages)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, query, hasActiveFilters])

  const resetForm = () => {
    setForm({
	      codigo: '',
	      origenOaci: '',
	      destinoOaci: '',
	      salidaLocal: '',
	      llegadaLocal: '',
	      salidaUtcOffsetMin: 0,
	      duracionMin: 0,
	      origenGmt: 0,
	      destinoGmt: 0,
	      capacidad: 150,
      cancelado: false,
    })
    setCapacidadText('150')
    setFlightCodeSuffix('')
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
    const suffix = item.codigo && item.codigo.length > 8 ? item.codigo.substring(8) : ''
    setFlightCodeSuffix(suffix)
    setIsModalOpen(true)
    void ensureAirports()
  }

  const handleDelete = async (id?: number) => {
    if (!id) return
    await deleteFlight(id)
    await load()
  }

  const getLimaDate = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())

    const year = parts.find((part) => part.type === 'year')?.value ?? ''
    const month = parts.find((part) => part.type === 'month')?.value ?? ''
    const day = parts.find((part) => part.type === 'day')?.value ?? ''
    return `${year}-${month}-${day}`
  }

  const getSimulatedCancelContext = () => {
    if (!simulation.requestedStart || currentMinute === null) {
      return null
    }

    const displayMinuteRaw =
      simulation.displayOffset !== null
        ? currentMinute + simulation.displayOffset
        : currentMinute

    if (displayMinuteRaw === null) {
      return null
    }

    const dayIndex = Math.floor(displayMinuteRaw / 1440)
    const minuteOfDay = ((displayMinuteRaw % 1440) + 1440) % 1440

    return {
      contextDate: formatIsoDateFromDayIndex(dayIndex),
      contextMinuteOfDay: minuteOfDay,
    }
  }

  const handleCancelDay = async (id?: number) => {
    if (!id) return
    setDayCancelLoadingId(id)
    setError(null)
    try {
      const simulationActive = status === 'READY' || status === 'RUNNING' || status === 'PAUSED'
      const simulatedContext = simulationActive ? getSimulatedCancelContext() : null
      const fecha = simulatedContext?.contextDate ?? getLimaDate()
      let airportCatalog = airports

      if (airportCatalog.length === 0) {
        const airportResult = await listAirports(0, 1000, '')
        airportCatalog = airportResult.content
        setAirports(airportCatalog)
        setAirportsLoaded(true)
      }

      const flight = items.find((item) => item.id === id) ?? allItems.find((item) => item.id === id)
      const origin = flight ? airportCatalog.find((airport) => airport.codigoOaci.toUpperCase() === flight.origenOaci.toUpperCase()) : null
      const destination = flight ? airportCatalog.find((airport) => airport.codigoOaci.toUpperCase() === flight.destinoOaci.toUpperCase()) : null
	      const salidaMin = flight ? flight.salidaUtcOffsetMin : null
	      const llegadaMin = flight ? flight.salidaUtcOffsetMin + flight.duracionMin : null

      console.log('[FlightsCrud] cancel day', {
        flightId: id,
        fecha,
        simulationActive,
        simulatedContext,
      })
      await cancelFlightDay(id, fecha, simulatedContext ?? undefined)
      appendCancelledFlightDay({
        flightId: id,
        fecha,
        sourceType: 'REAL',
        origen: flight?.origenOaci,
        destino: flight?.destinoOaci,
        origenLat: origin?.latitud,
        origenLon: origin?.longitud,
        destinoLat: destination?.latitud,
        destinoLon: destination?.longitud,
        salidaMin: salidaMin ?? undefined,
        llegadaMin: llegadaMin ?? undefined,
      })
      console.log('[FlightsCrud] cancelled day stored', {
        flightId: id,
        fecha,
        origen: flight?.origenOaci,
        destino: flight?.destinoOaci,
        origenLat: origin?.latitud,
        origenLon: origin?.longitud,
        destinoLat: destination?.latitud,
        destinoLon: destination?.longitud,
        salidaMin,
        llegadaMin,
      })
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cancelar el vuelo para el dia'
      setError(msg)
    } finally {
      setDayCancelLoadingId(null)
    }
  }

  const handleNew = () => {
    resetForm()
    setIsModalOpen(true)
    void ensureAirports()
  }

  const ensureAirports = async () => {
    if (airportsLoaded) return
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
    if (value.trim() === '') return 0
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  const filteredAndPaginatedItems = useMemo(() => {
    const dataToFilter = hasActiveFilters ? allItems : items
    const filtered = dataToFilter.filter(item => {
      const origenMatch = !filterOrigen || item.origenOaci.toUpperCase().includes(filterOrigen.toUpperCase())
      const destinoMatch = !filterDestino || item.destinoOaci.toUpperCase().includes(filterDestino.toUpperCase())
      return origenMatch && destinoMatch
    })

    if (hasActiveFilters) {
      const pageSize = 10
      const startIdx = page * pageSize
      const endIdx = startIdx + pageSize
      const localTotalPages = Math.ceil(filtered.length / pageSize)
      setTotalPages(localTotalPages)
      return filtered.slice(startIdx, endIdx)
    }

    return filtered
  }, [allItems, items, page, filterOrigen, filterDestino, hasActiveFilters])

  const formatLocation = (codigo?: string, ciudad?: string) => {
    if (!codigo) return '--'
    return `${codigo}-${ciudad ?? '--'}`
  }

  const getFilteredAirports = (value: string) => {
    const queryLower = value.trim().toLowerCase()
    if (!queryLower) return airports
    return airports.filter((airport) => {
      const nombre = airport.nombre.toLowerCase()
      const ciudad = (airport.ciudad ?? '').toLowerCase()
      const codigo = airport.codigoOaci.toLowerCase()
      return codigo.includes(queryLower) || nombre.includes(queryLower) || ciudad.includes(queryLower)
    })
  }

  const handleSelectAirport = (kind: 'origen' | 'destino', codigo: string) => {
    setForm((current) => {
      const isOrigen = kind === 'origen'
      const newValues = {
        ...current,
        [isOrigen ? 'origenOaci' : 'destinoOaci']: codigo,
      }

      const origen = (isOrigen ? codigo : newValues.origenOaci) || '----'
      const destino = (!isOrigen ? codigo : newValues.destinoOaci) || '----'

      const prefix = `${origen.substring(0, 4)}${destino.substring(0, 4)}`
      newValues.codigo = `${prefix}${flightCodeSuffix}`
      return newValues
    })
    setActiveOaciList(null)
  }

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <div className="crud-header-main">
          <h2>Vuelos</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1 }}>
          <div className="crud-search">
            <input
              type="text"
              placeholder="Filtrar por ORIGEN (OACI)"
              value={filterOrigen}
              onChange={(event) => {
                setFilterOrigen(event.target.value)
                setPage(0)
              }}
            />
          </div>
          <div className="crud-search">
            <input
              type="text"
              placeholder="Filtrar por DESTINO (OACI)"
              value={filterDestino}
              onChange={(event) => {
                setFilterDestino(event.target.value)
                setPage(0)
              }}
            />
          </div>
        </div>
        <div className="crud-header-actions">
          <button className="btn primary" onClick={handleNew}>Nuevo vuelo</button>
          <button className="btn ghost" onClick={() => setIsUploadOpen(true)}>Cargar TXT</button>
        </div>
      </div>

      {error ? <div className="crud-error">{error}</div> : null}

      <div className="crud-table">
        {/* CABECERA CORREGIDA CON LAS CLASES DE ALINEACIÓN */}
        <div className="crud-row flights header">
          <span>Código</span>
          <span>Origen</span>
          <span>Destino</span>
          <span>Salida</span>
          <span>Llegada</span>
          <span className="capacity">Cap.</span>
          <span className="status-header">Estado</span>
          <span className="flight-actions-header">Acciones</span>
        </div>
        
        {loading && <div className="crud-empty">Cargando...</div>}
        {!loading && filteredAndPaginatedItems.length === 0 && <div className="crud-empty">Sin registros</div>}

        {filteredAndPaginatedItems.map((item) => (
          <div className="crud-row flights" key={item.id}>
            <span className="flight-code">{item.codigo}</span>
            <span>{formatLocation(item.origenOaci, item.origenCiudad)}</span>
            <span>{formatLocation(item.destinoOaci, item.destinoCiudad)}</span>
	            <span className="datetime">{`${item.salidaLocal} ${formatGmtOffset(item.origenGmt)}`}</span>
	            <span className="datetime">{`${item.llegadaLocal} ${formatGmtOffset(item.destinoGmt)}`}</span>
            <span className="capacity">{formatInteger(item.capacidad)}</span>
            <span className={`status-badge ${item.cancelado ? 'cancelled' : 'active'}`}>
              {item.cancelado ? 'Cancelado' : 'Activo'}
            </span>
            
            {/* BOTONES CON SUS RESPECTIVAS CLASES A LAS QUE DISTE ESTILO */}
            <div className="flight-actions">
              <button className="btn-icon btn-view" onClick={() => onViewDetail(item.id!)} title="Ver detalle">📋</button>
              <button className="btn-icon btn-edit" onClick={() => handleEdit(item)} title="Editar">✏️</button>
              <button
                className="btn-icon btn-day-cancel"
                onClick={() => handleCancelDay(item.id)}
                title="Cancelar solo este día"
                disabled={dayCancelLoadingId === item.id}
              >
                {dayCancelLoadingId === item.id ? '...' : '🗓️'}
              </button>
              <button className="btn-icon btn-delete" onClick={() => handleDelete(item.id)} title="Eliminar">🗑️</button>
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

      {/* Modal de creación/edición (sin cambios visuales relevantes) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? 'Editar vuelo' : 'Nuevo vuelo'}</h3>
              <button className="btn" onClick={() => setIsModalOpen(false)}>Cerrar</button>
            </div>
            <div className="modal-body">
              <label className="field">
                Código
                <div style={{ display: 'flex' }}>
                  <input
                    value={`${(form.origenOaci || '----').substring(0, 4)}${(form.destinoOaci || '----').substring(0, 4)}`}
                    readOnly
                    style={{
                      backgroundColor: '#e9ecef',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      borderRight: 0,
                      width: '110px',
                      flexShrink: 0,
                    }}
                    title="Prefijo autogenerado (Origen-Destino)"
                  />
                  <input
                    value={flightCodeSuffix}
                    onChange={(e) => {
                      const newSuffix = e.target.value
                      setFlightCodeSuffix(newSuffix)
                      const prefix = `${(form.origenOaci || '----').substring(0, 4)}${(form.destinoOaci || '----').substring(0, 4)}`
                      setForm(current => ({ ...current, codigo: `${prefix}${newSuffix}` }))
                    }}
                    placeholder="-****-****"
                    style={{ flexGrow: 1 }}
                  />
                </div>
              </label>
              <label className="field">
                Origen (OACI)
                <div className="oaci-field">
                  <input
                    type="text"
                    placeholder="Buscar OACI"
                    value={form.origenOaci}
                    onFocus={() => setActiveOaciList('origen')}
                    onChange={(e) => {
                      setForm({ ...form, origenOaci: e.target.value.toUpperCase() })
                      setActiveOaciList('origen')
                    }}
                    onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'origen' ? null : current)), 150)}
                  />
                  {activeOaciList === 'origen' && (
                    <div className="oaci-list">
                      {getFilteredAirports(form.origenOaci).map((airport) => (
                        <button
                          key={airport.codigoOaci}
                          type="button"
                          className="oaci-option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectAirport('origen', airport.codigoOaci)}
                        >
                          <span className="oaci-code">{airport.codigoOaci}</span>
                          <span className="oaci-name">{airport.ciudad ?? airport.nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}
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
                    onChange={(e) => {
                      setForm({ ...form, destinoOaci: e.target.value.toUpperCase() })
                      setActiveOaciList('destino')
                    }}
                    onBlur={() => setTimeout(() => setActiveOaciList((current) => (current === 'destino' ? null : current)), 150)}
                  />
                  {activeOaciList === 'destino' && (
                    <div className="oaci-list">
                      {getFilteredAirports(form.destinoOaci).map((airport) => (
                        <button
                          key={airport.codigoOaci}
                          type="button"
                          className="oaci-option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectAirport('destino', airport.codigoOaci)}
                        >
                          <span className="oaci-code">{airport.codigoOaci}</span>
                          <span className="oaci-name">{airport.ciudad ?? airport.nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label className="field">
                Salida
	                <input type="time" value={form.salidaLocal} onChange={(e) => setForm({ ...form, salidaLocal: e.target.value })} />
              </label>
              <label className="field">
                Llegada
	                <input type="time" value={form.llegadaLocal} onChange={(e) => setForm({ ...form, llegadaLocal: e.target.value })} />
              </label>
              <label className="field">
                Capacidad
                <input type="text" inputMode="numeric" value={capacidadText} onChange={(e) => handleIntChange(e.target.value, setCapacidadText)} />
              </label>
              <label className="crud-checkbox">
                <input type="checkbox" checked={form.cancelado} onChange={(e) => setForm({ ...form, cancelado: e.target.checked })} />
                Cancelado global
              </label>
              <div className="field-hint">
                Use DIA para cancelar solo el vuelo operativo del dia actual con regla de 1 hora.
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn primary" onClick={handleSubmit}>{form.id ? 'Actualizar' : 'Crear'}</button>
              <button className="btn" onClick={resetForm}>Limpiar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de carga de TXT (sin cambios) */}
      {isUploadOpen && (
        <div className="modal-backdrop" onClick={closeUploadModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                    <input type="file" accept=".txt" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} hidden />
                  </label>
                </div>
                <div className="upload-summary">
                  <span>{`Archivo: ${uploadFile ? uploadFile.name : 'Ninguno'}`}</span>
                  <span>{`Tamaño: ${formatFileSize(uploadFile?.size ?? 0)}`}</span>
                </div>
                {uploadError && <div className="upload-error">{uploadError}</div>}
                {uploadResult && (
                  <div className={uploadResult.skipped === 0 ? 'upload-success' : 'upload-error'}>
                    <div>{`Total: ${formatInteger(uploadResult.total)}. Insertados: ${formatInteger(uploadResult.inserted)}. Actualizados: ${formatInteger(uploadResult.updated)}. Omitidos: ${formatInteger(uploadResult.skipped)}.`}</div>
                    {uploadResult.invalidAirportLines.length > 0 && (
                      <div>
                        <div>Los siguientes registros referencian Aeropuertos que no existen:</div>
                        <pre className="upload-list">{uploadResult.invalidAirportLines.join('\n')}</pre>
                      </div>
                    )}
                    {uploadResult.invalidFormatLines.length > 0 && (
                      <div>
                        <div>Los siguientes registros no siguen el formato correcto:</div>
                        <pre className="upload-list">{uploadResult.invalidFormatLines.join('\n')}</pre>
                      </div>
                    )}
                  </div>
                )}
                <div className="upload-footer">
                  <button className="btn primary" onClick={handleUpload} disabled={uploadLoading}>
                    {uploadLoading ? 'Cargando...' : 'Cargar vuelos'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
