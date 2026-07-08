import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Calendar, ShieldAlert, Lock } from 'lucide-react';
import { fetchOperationAlerts, type OperationAlertDto } from '../../services/api';
import { formatDate } from '../../utils/time';

// Escenario 3: la simulación de colapso se dispara con el mismo startSimulation()
// (flags buscarColapso / colapsoIncremental en SimulationRequest). El "reporte" de
// ese escenario es el listado de alertas que DailyOperationService genera de forma
// dinámica evaluando el snapshot de almacenes (buildWarehouseSnapshot): al superar
// 80% de capacidad se emite WARNING, al superar 95% se emite DANGER. Esas alertas
// representan la última planificación estable justo antes/durante el colapso.
export default function OperationalCollapseReport() {
    const [alerts, setAlerts] = useState<OperationAlertDto[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [selectedDate, setSelectedDate] = useState<string>(today);

    useEffect(() => {
        setLoading(true);
        fetchOperationAlerts(selectedDate || undefined)
            .then(setAlerts)
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedDate]);

    const getSeverityBadge = (severity: string) => {
        switch (severity.toUpperCase()) {
            case 'DANGER':
                return { bg: 'rgba(127, 29, 29, 0.1)', color: '#7f1d1d', border: '1px solid rgba(127, 29, 29, 0.25)', text: 'Peligro (>95%)' };
            case 'CRITICAL':
                return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', text: 'Crítico' };
            case 'WARNING':
                return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', text: 'Advertencia (>80%)' };
            default:
                return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', text: 'Informativo' };
        }
    };

    return (
        <div>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>Escenario 3 · Simulación de Colapso</h2>
                    <p style={styles.subtitle}>Última planificación estable evidenciada al momento del colapso, mediante el desborde de capacidad de almacenes.</p>
                    <span style={styles.stableBadge}>
                        <Lock size={12} style={{ marginRight: 4 }} />
                        Planificación Estable — Fin de Simulación de Colapso
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div style={styles.filtersWrapper}>
                <div style={styles.filterField}>
                    <label style={styles.label}>Filtrar por Fecha Operacional</label>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <Calendar size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                        <input
                            type="date"
                            value={selectedDate}
                            max={today}
                            onChange={(e) => setSelectedDate(e.target.value || today)}
                            style={{ ...styles.input, paddingLeft: '32px' }}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Cargando alertas...</div>
            ) : (
                <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={styles.th}>ID</th>
                                <th style={styles.th}>Nivel de Severidad</th>
                                <th style={styles.th}>Detalle de la Alerta</th>
                                <th style={styles.th}>Fecha de Registro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={styles.emptyCell}>
                                        <ShieldAlert size={32} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                                        <p>No se registraron incidentes ni alertas de colapso en la fecha seleccionada.</p>
                                    </td>
                                </tr>
                            ) : (
                                alerts.map((alert) => {
                                    const badge = getSeverityBadge(alert.severity);
                                    return (
                                        <tr key={alert.id} style={styles.tr}>
                                            <td style={styles.td}><strong>#{alert.id}</strong></td>
                                            <td style={styles.td}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', padding: '4px 8px',
                                                    borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                                                    backgroundColor: badge.bg, color: badge.color, border: badge.border
                                                }}>
                                                    <AlertCircle size={12} style={{ marginRight: 4 }} />
                                                    {badge.text}
                                                </span>
                                            </td>
                                            <td style={styles.td}>{alert.message}</td>
                                            <td style={styles.td}>{formatDate(alert.createdAt)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const styles = {
    header: { marginBottom: '16px' },
    title: { fontSize: '24px', fontWeight: 700, color: '#1b3d6b', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: '#64748b', maxWidth: '620px' },
    stableBadge: {
        display: 'inline-flex', alignItems: 'center', marginTop: '10px',
        padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
        backgroundColor: 'rgba(47, 98, 181, 0.1)', color: '#2f62b5', border: '1px solid rgba(47, 98, 181, 0.2)',
        letterSpacing: '0.2px',
    },
    filtersWrapper: {
        backgroundColor: '#f8fafc',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #f1f5f9',
        display: 'flex',
        gap: '16px'
    },
    filterField: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    label: { fontSize: '12px', fontWeight: 600, color: '#475569' },
    input: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', outline: 'none' },
    table: { width: '100%', borderCollapse: 'collapse' as const, textAlign: 'left' as const, fontSize: '13px' },
    th: { padding: '12px 16px', fontWeight: 600, color: '#64748b', fontSize: '12px' },
    tr: { borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' },
    td: { padding: '14px 16px', verticalAlign: 'middle', color: '#1e3b67' },
    emptyCell: { padding: '40px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '14px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
};