import { useEffect, useState } from 'react'
import type { FlightCrudDto, ShipmentCrudDto } from '../types/sim'
import { getFlightById, getShipmentsByFlight } from '../services/api'

interface FlightDetailPageProps {
  flightId: number
  onVolver: () => void
}

export default function FlightDetailPage({ flightId, onVolver }: FlightDetailPageProps) {
  const [flight, setFlight] = useState<FlightCrudDto | null>(null);
  const [shipments, setShipments] = useState<ShipmentCrudDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fData, sData] = await Promise.all([
          getFlightById(flightId),
          getShipmentsByFlight(flightId),
        ]);
        setFlight(fData);
        setShipments(sData);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Error al cargar los datos del vuelo');
      } finally {
        setLoading(false);
      }
    };
    void loadDetail();
  }, [flightId]);

  const totalCargaAsignada = shipments.reduce((sum, s) => sum + (s.cantidad ?? 0), 0);
  const porcentajeOcupacion = flight?.capacidad
    ? Math.min(100, Math.round((totalCargaAsignada / flight.capacidad) * 100))
    : 0;

  if (loading) return <div className="crud-panel"><div className="crud-empty">Cargando detalles del vuelo...</div></div>;
  if (error) return <div className="crud-panel"><div className="crud-empty">Error: {error}</div></div>;

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <div className="crud-header-main">
          <button className="btn ghost" onClick={onVolver} style={{ marginRight: '1rem' }}>← Volver</button>
          <h2>Detalle de Vuelo: <span style={{ color: 'var(--primary)' }}>{flight?.codigo}</span></h2>
        </div>
      </div>

      {/* Tarjeta de métricas básicas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="upload-card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1rem' }}>
          <h3>Ruta del Segmento</h3>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
            {flight?.origenOaci} → {flight?.destinoOaci}
          </p>
          <small>{flight?.origenCiudad} a {flight?.destinoCiudad}</small>
        </div>

        <div className="upload-card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1rem' }}>
          <h3>Capacidad de Carga</h3>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0' }}>
            {totalCargaAsignada} / {flight?.capacidad} kg
          </p>
          <div style={{ background: '#eee', borderRadius: '4px', height: '8px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ background: porcentajeOcupacion > 90 ? '#ef4444' : '#3b82f6', width: `${porcentajeOcupacion}%`, height: '100%' }}></div>
          </div>
          <small>Ocupación al {porcentajeOcupacion}%</small>
        </div>

        <div className="upload-card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1rem' }}>
          <h3>Horario Programado</h3>
          <small><b>Salida:</b> {flight?.salida?.replace('T', ' ')}</small><br />
          <small><b>Llegada:</b> {flight?.llegada?.replace('T', ' ')}</small>
        </div>
      </div>

      <div className="crud-header-main">
        <h3>Listado de Envíos Asignados a este Vuelo</h3>
      </div>

      <div className="crud-table" style={{ marginTop: '1rem' }}>
        <div className="crud-row shipments header">
          <span>Código Pedido</span>
          <span>Origen</span>
          <span>Destino</span>
          <span>Fecha Asignación</span>
          <span>Carga (kg)</span>
          <span>SLA</span>
        </div>
        
        {shipments.length === 0 ? (
          <div className="crud-empty">No hay paquetes asociados a este vuelo en el plan actual.</div>
        ) : (
          shipments.map((ship) => (
            <div className="crud-row shipments" key={ship.id}>
              <span style={{ fontWeight: 'bold' }}>{ship.codigoPedido}</span>
              <span>{ship.origen}-{ship.origenCiudad}</span>
              <span>{ship.destino}-{ship.destinoCiudad}</span>
              <span>{ship.fecha}</span>
              <span>{ship.cantidad} kg</span>
              <span>{ship.slaHoras}h</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}