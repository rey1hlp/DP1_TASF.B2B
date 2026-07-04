import { useEffect, useMemo, useState } from 'react'
import type { FlightCrudDto, ShipmentCrudDto } from '../types/sim'
import { getFlightById, getShipmentsByFlight } from '../services/api'
import {
  formatBags,
  formatDate,
  //formatDateTime,
  formatDurationHours,
  formatPercent,
  formatDateFromDayIndex,
  formatClockFromMinute
} from '../utils/time'

interface FlightDetailPageProps {
  flightId: number
  onVolver: () => void
  isSimulation?: boolean
  simId?: string
  simulationFlight?: any
  simulationData?: {
    simId?: string | null
    currentMinute?: number | null
    [key: string]: any
  }
}

export default function FlightDetailPage({
  flightId,
  onVolver,
  isSimulation = false,
  simId,
  simulationFlight,
  //simulationData
}: FlightDetailPageProps) {
  const [flight, setFlight] = useState<FlightCrudDto | null>(null);
  const [shipments, setShipments] = useState<ShipmentCrudDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOrigen, setFilterOrigen] = useState('');
  const [filterDestino, setFilterDestino] = useState('');

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isSimulation) {
          if (simulationFlight) {
            setFlight({
              id: simulationFlight.flightId,
              codigo: simulationFlight.codigo || `Vuelo ${simulationFlight.flightId}`,
              origen: simulationFlight.origen,
              origenOaci: simulationFlight.origen,
              destino: simulationFlight.destino,
              destinoOaci: simulationFlight.destino,
              origenCiudad: "Simulado",
              destinoCiudad: "Simulado",
              fechaSalida: "",
              fechaLlegada: "",
              capacidad: simulationFlight.capacidad || 0,
            } as any);
          }
          setShipments([]);
        } else {
          const [fData, sData] = await Promise.all([
            getFlightById(flightId),
            getShipmentsByFlight(flightId),
          ]);
          setFlight(fData);
          setShipments(sData);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Error al cargar los datos del vuelo');
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [flightId, isSimulation, simId, simulationFlight]);

  const filteredShipments = useMemo(() => {
    return shipments.filter(ship => {
      const origenMatch = !filterOrigen || ship.origen?.toUpperCase().includes(filterOrigen.toUpperCase());
      const destinoMatch = !filterDestino || ship.destino?.toUpperCase().includes(filterDestino.toUpperCase());
      return origenMatch && destinoMatch;
    });
  }, [shipments, filterOrigen, filterDestino]);

  // Cálculos de ocupación
  const totalCargaAsignada = isSimulation ? (simulationFlight?.ocupacion ?? 0) : filteredShipments.reduce((sum, s) => sum + (s.cantidad ?? 0), 0);
  const totalCapacidad = isSimulation ? (simulationFlight?.capacidad ?? flight?.capacidad ?? 1) : (flight?.capacidad ?? 1);
  const porcentajeOcupacion = (totalCargaAsignada / totalCapacidad) * 100;
  const espacioDisponible = Math.max(0, totalCapacidad - totalCargaAsignada);

  // Determinación de semáforo operacional
  let estadoOperacion = "🟢 Operación Fluida: Nivel Óptimo";
  if (porcentajeOcupacion > 70) {
    estadoOperacion = "🔴 Capacidad Crítica: Próximo a Saturación";
  } else if (porcentajeOcupacion > 30) {
    estadoOperacion = "🟡 Operación Moderada: Alta Carga";
  }

  // Tiempos simulados de vuelo
  const salidaMin = simulationFlight?.salidaMin ?? 0;
  const llegadaMin = simulationFlight?.llegadaMin ?? 0;
  const fechaSalidaSim = formatDateFromDayIndex(Math.floor(salidaMin / 1440));
  const horaSalidaSim = formatClockFromMinute(salidaMin);
  const fechaLlegadaSim = formatDateFromDayIndex(Math.floor(llegadaMin / 1440));
  const horaLlegadaSim = formatClockFromMinute(llegadaMin);

  // ⏱️ CORREGIDO: Mapeamos dinámicamente buscando tanto 'displayMinute' como 'currentMinute'
  //const currentMinute = simulationData?.displayMinute ?? simulationData?.currentMinute ?? null;
  //const fechaActualSim = currentMinute !== null ? formatDateFromDayIndex(Math.floor(currentMinute / 1440)) : '—';
  //const horaActualSim = currentMinute !== null ? formatClockFromMinute(currentMinute) : '—';

  if (loading) return <div className="crud-panel"><div className="crud-empty">Cargando detalles del vuelo...</div></div>;
  if (error) return <div className="crud-panel"><div className="crud-empty">Error: {error}</div></div>;

  return (
    <div className="crud-panel">
      {/* Encabezado idéntico al de Aeropuertos */}
      <div className="crud-header" style={{ marginBottom: '0.5rem' }}>
        <div className="crud-header-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <button className="btn ghost" onClick={onVolver} style={{ padding: '0', marginBottom: '0.5rem', fontSize: '14px' }}>← Volver</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>Detalle de Vuelo: <span style={{ color: 'var(--primary)' }}>{flight?.codigo}</span></h2>
            {isSimulation && (
              <span style={{ fontSize: '11px', color: '#2563eb', backgroundColor: '#dbeafe', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⚡ EN VIVO (SIMULACIÓN)
              </span>
            )}
          </div>
          <small style={{ color: '#6c757d', fontSize: '14px', marginTop: '2px' }}>
            Ruta del Segmento: <b>{flight?.origenOaci}</b> → <b>{flight?.destinoOaci}</b>
          </small>
        </div>
      </div>

      {/* Franja de Estado Principal */}
      <div style={{ marginBottom: '1.5rem', fontSize: '15px' }}>
        Ocupación en Bodega de Aeronave: <b>{totalCargaAsignada} / {totalCapacidad}</b>
        <div style={{ marginTop: '4px', fontWeight: '500', color: porcentajeOcupacion > 90 ? '#ef4444' : porcentajeOcupacion > 60 ? '#d97706' : '#16a34a' }}>
          {estadoOperacion}
        </div>
      </div>

      <div className="crud-header-main" style={{ marginBottom: '1rem' }}>
        <h3>Consola de Estado de Carga Dinámica</h3>
      </div>

      {isSimulation ? (
        /* 📊 EN VIVO: Cuadrícula de Tarjetas con la misma métrica de Almacenes */
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="upload-card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#6c757d', fontSize: '13px', textTransform: 'uppercase' }}>Saturación Actual</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0', color: '#212529' }}>
                {formatPercent(porcentajeOcupacion, 1)}
              </p>
              <small style={{ color: '#858796' }}>Capacidad utilizada del avión</small>
            </div>

            <div className="upload-card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#6c757d', fontSize: '13px', textTransform: 'uppercase' }}>Espacio Disponible</h4>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0', color: '#212529' }}>
                {espacioDisponible}
              </p>
              <small style={{ color: '#858796' }}>Slots de equipaje libres</small>
            </div>

            <div className="upload-card" style={{ padding: '1.25rem', backgroundColor: '#f8f9fa', border: '1px solid #e3e6f0', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#495057', fontSize: '14px' }}>⏱️ Plan de Vuelo Programado</h4>
              <div>🛫 <b>Salida estimada del tramo:</b> {fechaSalidaSim} a las <b>{horaSalidaSim}</b></div>
              <div>🛬 <b>Llegada estimada del tramo:</b> {fechaLlegadaSim} a las <b>{horaLlegadaSim}</b></div>
              <div style={{ marginTop: '10px', color: '#858796', fontSize: '12px', borderTop: '1px solid #e3e6f0', paddingTop: '8px' }}>
                💡 El manifiesto detallado e individual por bultos se consolida dinámicamente en memoria y se reporta en las auditorías de cierre de tramo.
              </div>
            </div>
          </div>
        </>
      ) : (
        /* 🗓️ VISTA HISTÓRICA / TRADICIONAL */
        <>
          {/* Mapeo clásico de tabla si los datos no son de simulación en vivo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="crud-search">
              <input type="text" placeholder="Filtrar por ORIGEN (OACI)" value={filterOrigen} onChange={(e) => setFilterOrigen(e.target.value)} />
            </div>
            <div className="crud-search">
              <input type="text" placeholder="Filtrar por DESTINO (OACI)" value={filterDestino} onChange={(e) => setFilterDestino(e.target.value)} />
            </div>
          </div>

          <div className="crud-table">
            <div className="crud-row shipments header">
              <span>Código Pedido</span>
              <span>Origen</span>
              <span>Destino</span>
              <span>Fecha Asignación</span>
              <span>Maletas</span>
              <span>SLA</span>
            </div>
            {filteredShipments.length === 0 ? (
              <div className="crud-empty">No hay paquetes asociados en el plan guardado.</div>
            ) : (
              filteredShipments.map((ship) => (
                <div className="crud-row shipments" key={ship.id}>
                  <span style={{ fontWeight: 'bold' }}>{ship.codigoPedido}</span>
                  <span>{ship.origen}</span>
                  <span>{ship.destino}</span>
                  <span>{ship.fecha ? formatDate(ship.fecha) : '—'}</span>
                  <span>{formatBags(ship.cantidad)}</span>
                  <span>{formatDurationHours(ship.slaHoras, 0)}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
