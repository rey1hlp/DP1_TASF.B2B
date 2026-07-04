import { useEffect, useMemo, useState } from 'react'
import type { AirportCrudDto, ShipmentCrudDto } from '../types/sim'
import { getAirportByCode, getWarehouseShipments } from '../services/api'
// 📦 Importamos las funciones de formateo oficiales del proyecto
import { formatBags, formatGmtOffset, formatDateFromDayIndex, formatClockFromMinute } from '../utils/time'

interface WarehouseDetailPageProps {
  airportCode: string
  onVolver: () => void
  simulationData?: {
    simId: string
    currentMinute: number | null
    warehouseSnapshot: Record<string, { capacidad: number; ocupacion: number; porcentaje: number; libre: number }>
  }
}

export default function WarehouseDetailPage({ airportCode, onVolver, simulationData }: WarehouseDetailPageProps) {
  const [airport, setAirport] = useState<AirportCrudDto | null>(null);
  const [warehouseShipments, setWarehouseShipments] = useState<ShipmentCrudDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOrigen, setFilterOrigen] = useState('');
  const [filterDestino, setFilterDestino] = useState('');

  useEffect(() => {
    const loadAirportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const airportData = await getAirportByCode(airportCode);
        setAirport(airportData);

        if (!simulationData) {
          const shipmentsData = await getWarehouseShipments(airportCode);
          setWarehouseShipments(shipmentsData);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Error al cargar el almacén');
      } finally {
        setLoading(false);
      }
    };
    void loadAirportData();
  }, [airportCode, simulationData]);

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

  const snapshot = simulationData?.warehouseSnapshot[airportCode];
  const currentOccupation = snapshot?.ocupacion ?? totalCargaAlmacenada;
  const currentCapacity = snapshot?.capacidad ?? airport?.capacidad ?? 0;
  const isSimulationMode = !!simulationData;

  const pct = snapshot?.porcentaje ?? 0;
  const slotsLibres = snapshot?.libre ?? 0;

  const esCritico = pct > 75;
  const esAdvertencia = pct <= 75 && pct > 35;
  const colorEstado = esCritico ? '#ff4d4f' : esAdvertencia ? '#faad14' : '#52c41a';
  const colorFondoBadge = esCritico ? '#fff1f0' : esAdvertencia ? '#fffbe6' : '#f6ffed';
  const textoEstado = esCritico
    ? '🚨 Alerta Crítica: Riesgo de Colapso'
    : esAdvertencia
      ? '⚠️ Flujo Intenso: Capacidad Moderada'
      : '🟢 Operación Fluida: Nivel Óptimo';

  // ⏱️ CORRECCIÓN: Traducir el minuto absoluto a la fecha del calendario real usando las utilidades del proyecto
  const currentMin = simulationData?.currentMinute ?? 0;
  const fechaSimulada = formatDateFromDayIndex(Math.floor(currentMin / 1440));
  const horaSimulada = formatClockFromMinute(currentMin);
  const tiempoSimuladoLabel = `${fechaSimulada} - ${horaSimulada}`;

  return (
    <div className="crud-panel">
      <div className="crud-header">
        <div className="crud-header-main">
          <button className="btn ghost" onClick={onVolver} style={{ marginRight: '1rem' }}>← Volver</button>
          <h2>Detalle de Almacén: <span style={{ color: 'var(--primary)' }}>{airport?.codigoOaci}</span></h2>
        </div>
      </div>

      <div className="upload-card" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{airport?.nombre}</h3>
          {isSimulationMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                backgroundColor: '#0dcaf0',
                borderRadius: '50%',
                animation: 'pulse 1.5s infinite alternate'
              }} />
              <span style={{ fontSize: '12px', color: '#0dcaf0', fontWeight: 'bold', letterSpacing: '0.5px' }}>⚡ EN VIVO (SIMULACIÓN)</span>
            </div>
          )}
        </div>
        <p style={{ margin: '0.2rem 0', color: '#555' }}><b>Ubicación:</b> {airport?.ciudad}, {airport?.pais} ({formatGmtOffset(airport?.gmt)})</p>

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
            Ocupación Física de Bodega: <span style={{ color: colorEstado }}>{formatBags(currentOccupation)}</span> / {formatBags(currentCapacity)}
          </p>
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            padding: '4px 12px',
            borderRadius: '4px',
            color: colorEstado,
            backgroundColor: colorFondoBadge,
            border: `1px solid ${colorEstado}40`
          }}>
            {textoEstado}
          </span>
        </div>
      </div>

      <div className="crud-header-main" style={{ marginBottom: '1rem' }}>
        <h3>{isSimulationMode ? 'Consola de Estado de Carga Dinámica' : 'Envíos físicos actualmente en Almacén'}</h3>
      </div>

      {isSimulationMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="upload-card" style={{ padding: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: `4px solid ${colorEstado}` }}>
              <span style={{ fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase' }}>Saturación Actual</span>
              <strong style={{ fontSize: '1.8rem', color: colorEstado }}>{pct.toFixed(1)}%</strong>
              <span style={{ fontSize: '11px', color: '#aaa' }}>Capacidad utilizada del nodo</span>
            </div>

            <div className="upload-card" style={{ padding: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #0dcaf0' }}>
              <span style={{ fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase' }}>Espacio Disponible</span>
              <strong style={{ fontSize: '1.8rem', color: '#097187' }}>{formatBags(slotsLibres)}</strong>
              <span style={{ fontSize: '11px', color: '#aaa' }}>Slots de equipaje libres</span>
            </div>

            <div className="upload-card" style={{ padding: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #6c757d' }}>
              <span style={{ fontSize: '12px', color: '#888', fontWeight: '600', textTransform: 'uppercase' }}>Fecha y Hora Simulada</span>
              <strong style={{ fontSize: '1.25rem', margin: '0.4rem 0', color: '#444', fontWeight: '700' }}>{tiempoSimuladoLabel}</strong>
              <span style={{ fontSize: '11px', color: '#aaa' }}>Cronología actual del proceso</span>
            </div>
          </div>

          <div className="upload-card" style={{ padding: '1.25rem', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '13px', fontWeight: '600', color: '#555' }}>
              <span>Nivel de Llenado Físico</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', height: '12px', backgroundColor: '#e9ecef', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(pct, 100)}%`,
                height: '100%',
                backgroundColor: colorEstado,
                borderRadius: '6px',
                transition: 'width 0.5s ease-in-out'
              }} />
            </div>
          </div>

          <div className="upload-card" style={{
            padding: '1.25rem',
            margin: 0,
            backgroundColor: '#f8f9fa',
            border: '1px dashed #ccc',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: '#495057', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📡 Monitor de Telemetría Aeroportuaria
              </h4>
              <span style={{ fontSize: '11px', color: '#20c997', backgroundColor: '#e6fffa', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                STREAMING ACTIVO
              </span>
            </div>
            <p style={{ fontSize: '13px', margin: 0, color: '#6c757d', lineHeight: '1.5' }}>
              Las cargas de este nodo se calculan concurrentemente en el motor de optimización matemática de la simulación.
            </p>
            <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #e3e6f0', fontSize: '12px', color: '#858796' }}>
              📌 <b>Nota del Sistema:</b> El listado detallado e histórico de manifiestos individuales de maletas se restringe durante los flujos dinámicos en vivo para resguardar la fluidez y rendimiento de renderizado del mapa principal. Puedes consultar el histórico cerrado desde el módulo estático de Aeropuertos.
            </div>
          </div>

        </div>
      ) : (
        <>
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
              <span>Maletas</span>
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
                  <span>{formatBags(ship.cantidad)}</span>
                  <span>{ship.idCliente}</span>
                  <span>En Almacén</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          from { opacity: 0.4; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
