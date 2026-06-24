import { useEffect, useMemo, useState } from 'react'
import type { AirportCrudDto, ShipmentCrudDto } from '../types/sim'
import { getAirportByCode, getWarehouseShipments } from '../services/api'
import { formatGmtOffset, formatKg } from '../utils/time'

interface WarehouseDetailPageProps {
  airportCode: string
  onVolver: () => void
}

export default function WarehouseDetailPage({ airportCode, onVolver }: WarehouseDetailPageProps) {
  const [airport, setAirport] = useState<AirportCrudDto | null>(null);
  const [warehouseShipments, setWarehouseShipments] = useState<ShipmentCrudDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOrigen, setFilterOrigen] = useState('');
  const [filterDestino, setFilterDestino] = useState('');

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

  const filteredShipments = useMemo(() => {
    return warehouseShipments.filter(ship => {
      const origenMatch = !filterOrigen || ship.origen.toUpperCase().includes(filterOrigen.toUpperCase());
      const destinoMatch = !filterDestino || ship.destino.toUpperCase().includes(filterDestino.toUpperCase());
      return origenMatch && destinoMatch;
    });
  }, [warehouseShipments, filterOrigen, filterDestino]);

  const totalCargaAlmacenada = filteredShipments.reduce((sum, s) => sum + (s.cantidad ?? 0), 0);

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
        <p style={{ margin: '0.2rem 0' }}><b>Ubicación:</b> {airport?.ciudad}, {airport?.pais} ({formatGmtOffset(airport?.gmt)})</p>
        <p style={{ margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>
          Ocupación Física de Bodega: {formatKg(totalCargaAlmacenada)}
        </p>
      </div>

      <div className="crud-header-main">
        <h3>Envíos físicos actualmente en Almacén</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="crud-search">
          <input
            type="text"
            placeholder="Filtrar por ORIGEN (OACI)"
            value={filterOrigen}
            onChange={(e) => setFilterOrigen(e.target.value)}
          />
        </div>
        <div className="crud-search">
          <input
            type="text"
            placeholder="Filtrar por DESTINO (OACI)"
            value={filterDestino}
            onChange={(e) => setFilterDestino(e.target.value)}
          />
        </div>
      </div>

      <div className="crud-table" style={{ marginTop: '1rem' }}>
        <div className="crud-row shipments header">
          <span>Código Pedido</span>
          <span>Tipo en Almacén</span>
          <span>Ruta Original</span>
          <span>Volumen/Peso</span>
          <span>Cliente</span>
          <span>Estado</span>
        </div>

        {filteredShipments.map((ship) => {
          const esSaliente = ship.origen === airportCode;
          return (
            <div className="crud-row shipments" key={ship.id}>
              <span style={{ fontWeight: 'bold' }}>{ship.codigoPedido}</span>
              <span className={`status-badge ${esSaliente ? 'active' : 'cancelled'}`} style={{ textAlign: 'center' }}>
                {esSaliente ? 'Carga Saliente' : 'Carga Entrante'}
              </span>
              <span>{ship.origen} → {ship.destino}</span>
              <span>{formatKg(ship.cantidad)}</span>
              <span>{ship.idCliente}</span>
              <span>En Almacén</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
