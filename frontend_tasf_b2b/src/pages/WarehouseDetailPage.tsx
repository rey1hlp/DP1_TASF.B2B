import { useEffect, useState } from 'react'
import type { AirportCrudDto, ShipmentCrudDto } from '../types/sim'
import { getAirportByCode, getWarehouseShipments } from '../services/api'

interface WarehouseDetailPageProps {
  airportCode: string
  onVolver: () => void
}

export default function WarehouseDetailPage({ airportCode, onVolver }: WarehouseDetailPageProps) {
  const [airport, setAirport] = useState<AirportCrudDto | null>(null);
  const [warehouseShipments, setWarehouseShipments] = useState<ShipmentCrudDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWarehouseDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const [airportData, shipmentsData] = await Promise.all([
          getAirportByCode(airportCode),
          getWarehouseShipments(airportCode),
        ]);
        setAirport(airportData);
        setWarehouseShipments(shipmentsData);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Error al cargar el almacén');
      } finally {
        setLoading(false);
      }
    };
    void loadWarehouseDetail();
  }, [airportCode]);

  const totalCargaAlmacenada = warehouseShipments.reduce((sum, s) => sum + (s.cantidad ?? 0), 0);

  if (loading) return <div className="crud-panel"><div className="crud-empty">Cargando estado del almacén...</div></div>;
  if (error) return <div className="crud-panel"><div className="crud-empty">Error: {error}</div></div>;

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <div className="crud-header-main">
          <button className="btn ghost" onClick={onVolver} style={{ marginRight: '1rem' }}>← Volver</button>
          <h2>Detalle de Almacén: <span style={{ color: 'var(--primary)' }}>{airport?.codigoOaci}</span></h2>
        </div>
      </div>

      <div className="upload-card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)', padding: '1rem', marginBottom: '2rem' }}>
        <h3>{airport?.nombre}</h3>
        <p style={{ margin: '0.2rem 0' }}><b>Ubicación:</b> {airport?.ciudad}, {airport?.pais} (GMT {airport?.gmt})</p>
        <p style={{ margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>
          Ocupación Física de Bodega: {totalCargaAlmacenada} kg
        </p>
      </div>

      <div className="crud-header-main">
        <h3>Envíos físicos actualmente en Almacén</h3>
      </div>

      <div className="crud-table" style={{ marginTop: '1rem' }}>
        <div className="crud-row shipments header">
          <span>Código Pedido</span>
          <span>Tipo en Almacén</span>
          <span>Ruta Original</span>
          <span>Volumen/Peso</span>
          <span>Estado</span>
        </div>

        {warehouseShipments.map((ship) => {
          const esSaliente = ship.origen === airportCode;
          return (
            <div className="crud-row shipments" key={ship.id}>
              <span style={{ fontWeight: 'bold' }}>{ship.codigoPedido}</span>
              <span className={`status-badge ${esSaliente ? 'active' : 'cancelled'}`} style={{ textAlign: 'center' }}>
                {esSaliente ? 'Carga Saliente' : 'Carga Entrante'}
              </span>
              <span>{ship.origen} → {ship.destino}</span>
              <span>{ship.cantidad} kg</span>
              <span>En Almacén</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}