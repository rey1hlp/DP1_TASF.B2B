import { useEffect, useMemo, useState } from 'react'
import { createUser, deleteUser, listAirports, listUsers, updateUser, type AppUserCrudDto } from '../services/api'
import type { AirportCrudDto } from '../types/sim'
import Modal from './ui/Modal'
import Button from './ui/Button'

const EMPTY_FORM: AppUserCrudDto = {
  email: '',
  password: '',
  fullName: '',
  role: 'REGISTER',
  airportCode: '',
  enabled: true,
}

function roleLabel(role?: string) {
  if (role === 'ADMIN') return 'ADMIN'
  if (role === 'LOGISTICS') return 'LOGISTICS'
  if (role === 'REGISTER') return 'REGISTER'
  return 'USUARIO'
}

function roleClass(role?: string) {
  if (role === 'ADMIN') return 'role-admin'
  if (role === 'LOGISTICS') return 'role-logistics'
  if (role === 'REGISTER') return 'role-register'
  return 'role-default'
}

function formatEmployeeDateTime(value?: string | null) {
  if (!value) {
    return '--'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  if (match) {
    const [, yyyy, mm, dd, hh, min] = match
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    const dd = `${parsed.getDate()}`.padStart(2, '0')
    const mm = `${parsed.getMonth() + 1}`.padStart(2, '0')
    const yyyy = parsed.getFullYear()
    const hh = `${parsed.getHours()}`.padStart(2, '0')
    const min = `${parsed.getMinutes()}`.padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  }

  return value
}

export default function EmployeesCrud() {
  const [items, setItems] = useState<AppUserCrudDto[]>([])
  const [airports, setAirports] = useState<AirportCrudDto[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [airportQuery, setAirportQuery] = useState('')
  const [activeAirportList, setActiveAirportList] = useState(false)
  const [form, setForm] = useState<AppUserCrudDto>(EMPTY_FORM)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [users, airportList] = await Promise.all([
        listUsers(),
        airports.length > 0 ? Promise.resolve(airports) : listAirports(0, 1000, '').then((result) => result.content),
      ])
      setItems(users)
      if (airports.length === 0) {
        setAirports(airportList)
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
  }, [])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      return (
        item.fullName?.toLowerCase().includes(q) ||
        item.email?.toLowerCase().includes(q) ||
        item.role?.toLowerCase().includes(q) ||
        item.airportCode?.toLowerCase().includes(q)
      )
    })
  }, [items, query])

  const filteredAirports = useMemo(() => {
    const q = airportQuery.trim().toLowerCase()
    if (!q) return airports
    return airports.filter((airport) => {
      return (
        airport.codigoOaci.toLowerCase().includes(q) ||
        airport.nombre.toLowerCase().includes(q) ||
        (airport.ciudad ?? '').toLowerCase().includes(q)
      )
    })
  }, [airports, airportQuery])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setAirportQuery('')
    setActiveAirportList(false)
  }

  const handleNew = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const handleEdit = (item: AppUserCrudDto) => {
    setForm({
      ...EMPTY_FORM,
      ...item,
      password: '',
      airportCode: item.airportCode ?? '',
    })
    setAirportQuery(item.airportCode ?? '')
    setIsModalOpen(true)
  }

  const handleDelete = async (id?: number) => {
    if (!id) return
    if (!window.confirm('¿Eliminar este empleado?')) return
    await deleteUser(id)
    await load()
  }

  const handleSubmit = async () => {
    setError(null)
    const normalizedRole = form.role
    const payload: AppUserCrudDto = {
      ...form,
      email: form.email.trim().toLowerCase(),
      fullName: form.fullName.trim(),
      airportCode: normalizedRole === 'ADMIN' ? null : (form.airportCode ?? '').trim().toUpperCase(),
      password: form.password?.trim() ? form.password.trim() : undefined,
      enabled: form.enabled ?? true,
    }

    if (!payload.email || !payload.fullName || !payload.role) {
      setError('Completa los campos obligatorios.')
      return
    }
    if (payload.role !== 'ADMIN' && !payload.airportCode) {
      setError('El aeropuerto es obligatorio para LOGISTICS y REGISTER.')
      return
    }
    if (!form.id && !payload.password) {
      setError('La contraseña es obligatoria al crear un empleado.')
      return
    }

    try {
      if (form.id) {
        await updateUser(form.id, payload)
      } else {
        await createUser(payload)
      }
      setIsModalOpen(false)
      resetForm()
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    }
  }

  const setAirportByCode = (code: string) => {
    setForm((current) => ({ ...current, airportCode: code.toUpperCase() }))
    setAirportQuery(code.toUpperCase())
  }

  return (
    <div className="crud-panel employees-panel">
      <div className="crud-header">
        <div className="crud-header-main">
          <h2>Empleados</h2>
        </div>
        <div className="crud-search">
          <input
            type="text"
            placeholder="Buscar por nombre, email, rol o aeropuerto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="crud-header-actions">
          <Button variant="primary" onClick={handleNew}>Nuevo empleado</Button>
        </div>
      </div>

      {error ? <div className="crud-error">{error}</div> : null}
      {loading ? <div className="crud-empty">Cargando empleados...</div> : null}

      <div className="employees-grid">
        {!loading && filteredItems.length === 0 ? <div className="crud-empty">Sin registros</div> : null}
        {filteredItems.map((item) => (
          <article className="employee-card" key={item.id ?? item.email}>
            <div className="employee-card-top">
              <div>
                <div className="employee-name">{item.fullName}</div>
                <div className="employee-email">{item.email}</div>
              </div>
              <span className={`employee-role ${roleClass(item.role)}`}>{roleLabel(item.role)}</span>
            </div>

            <div className="employee-meta">
              <span>
                Aeropuerto: <strong>{item.airportCode ?? 'N/A'}</strong>
              </span>
              <span>
                Estado: <strong className={item.enabled ? 'employee-enabled' : 'employee-disabled'}>
                  {item.enabled ? 'Activo' : 'Inactivo'}
                </strong>
              </span>
            </div>

            <div className="employee-meta employee-meta-small">
              <span>{item.airportName ?? 'Sin aeropuerto asociado'}</span>
              <span>{item.lastLoginAt ? `Último ingreso: ${formatEmployeeDateTime(item.lastLoginAt)}` : 'Sin último ingreso'}</span>
            </div>
            <div className="employee-meta employee-meta-small">
              <span>{item.createdAt ? `Creado: ${formatEmployeeDateTime(item.createdAt)}` : 'Creado: --'}</span>
              <span>{item.updatedAt ? `Actualizado: ${formatEmployeeDateTime(item.updatedAt)}` : 'Actualizado: --'}</span>
            </div>

            <div className="employee-card-actions">
              <Button onClick={() => handleEdit(item)}>Editar</Button>
              <Button variant="secondary" onClick={() => handleDelete(item.id)}>Eliminar</Button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={form.id ? 'Editar empleado' : 'Nuevo empleado'}
        headerActions={<Button onClick={() => setIsModalOpen(false)}>Cerrar</Button>}
      >
        <div className="modal-body employees-modal-body">
          <label className="field">
            Nombre completo
            <input value={form.fullName ?? ''} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label className="field">
            Email
            <input value={form.email ?? ''} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="field">
            Contraseña {form.id ? '(dejar vacía para no cambiar)' : ''}
            <input
              type="password"
              value={form.password ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          <label className="field">
            Rol
            <select
              value={form.role ?? 'REGISTER'}
              onChange={(event) => {
                const nextRole = event.target.value as AppUserCrudDto['role']
                setForm((current) => ({
                  ...current,
                  role: nextRole,
                  airportCode: nextRole === 'ADMIN' ? '' : current.airportCode ?? '',
                }))
              }}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="LOGISTICS">LOGISTICS</option>
              <option value="REGISTER">REGISTER</option>
            </select>
          </label>
          {form.role !== 'ADMIN' ? (
            <label className="field">
              Aeropuerto
              <div className="oaci-field">
                <input
                  value={airportQuery || form.airportCode || ''}
                  placeholder="Buscar aeropuerto"
                  onFocus={() => setActiveAirportList(true)}
                  onChange={(event) => {
                    setAirportQuery(event.target.value)
                    setActiveAirportList(true)
                    setForm((current) => ({ ...current, airportCode: event.target.value.toUpperCase() }))
                  }}
                  onBlur={() => setTimeout(() => setActiveAirportList(false), 150)}
                />
                {activeAirportList ? (
                  <div className="oaci-list">
                    {filteredAirports.map((airport) => (
                      <button
                        key={airport.id ?? airport.codigoOaci}
                        type="button"
                        className="oaci-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setAirportByCode(airport.codigoOaci)}
                      >
                        <span className="oaci-code">{airport.codigoOaci}</span>
                        <span className="oaci-name">{airport.ciudad ?? airport.nombre}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
          ) : null}
          <label className="crud-checkbox">
            <input
              type="checkbox"
              checked={form.enabled ?? true}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Usuario activo
          </label>
        </div>
        <div className="modal-actions">
          <Button variant="primary" onClick={handleSubmit}>
            {form.id ? 'Actualizar' : 'Crear'}
          </Button>
          <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
        </div>
      </Modal>
    </div>
  )
}
