import { useState, useMemo, useEffect } from 'react';
import {
    Plane, Layers, AlertTriangle, TrendingUp, BarChart3, Filter,
    Search, Briefcase, Percent, ChevronRight, Calendar,
    CheckCircle, AlertCircle, Lock
} from 'lucide-react';
import { fetchOccupancyReport } from '../../services/api';
import { formatDate, formatInteger, formatPercent } from '../../utils/time';

export interface FlightOccupancyData {
    flightCode: string;
    origin: string;
    destination: string;
    maxCapacity: number;
    bagsCount: number;
    simulationPeriod: string;
    date: string;
}

// El backend (DailyPlanSegmentRepository) ya filtra por MAX(id) agrupado por
// plan_date, por lo que /api/reports/occupancy siempre devuelve la última
// planificación ESTABLE, nunca intentos intermedios del algoritmo genético.
//   - mode "period": sin fecha -> histórico consolidado de cierres por periodo (Escenario 1)
//   - mode "daily":  con fecha -> cierre estable de ese día operativo (Escenario 2)
export type FlightOccupancyMode = 'period' | 'daily';

interface FlightOccupancyReportProps {
    mode: FlightOccupancyMode;
}

const MODE_COPY: Record<FlightOccupancyMode, { title: string; subtitle: string; badge: string }> = {
    period: {
        title: 'Escenario 1 · Cierre de Periodo',
        subtitle: 'Última planificación estable al finalizar la simulación de cada periodo ejecutado.',
        badge: 'Planificación Estable — Fin de Periodo',
    },
    daily: {
        title: 'Escenario 2 · Cierre Diario',
        subtitle: 'Última planificación estable al cerrar las operaciones del día seleccionado.',
        badge: 'Planificación Estable — Cierre del Día',
    },
};

export default function FlightOccupancyReport({ mode }: FlightOccupancyReportProps) {
    const [data, setData] = useState<FlightOccupancyData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'normal' | 'warning' | 'critical'>('all');

    // En modo "daily" el reporte SIEMPRE requiere una fecha de cierre (por defecto, hoy).
    // En modo "period" no se envía fecha: el backend regresa el histórico de cierres estables.
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [selectedDate, setSelectedDate] = useState<string>(mode === 'daily' ? today : '');

    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 10;
    const copy = MODE_COPY[mode];

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedPeriod, searchQuery, occupancyFilter]);

    useEffect(() => {
        setLoading(true);
        const dateParam = mode === 'daily' ? (selectedDate || today) : undefined;
        fetchOccupancyReport(dateParam)
            .then(setData)
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [mode, selectedDate, today]);

    const periods = useMemo(() => Array.from(new Set(data.map(item => item.simulationPeriod))), [data]);

    const periodMetrics = useMemo(() => {
        const metrics: Record<string, any> = {};
        data.forEach((item) => {
            if (!metrics[item.simulationPeriod]) {
                metrics[item.simulationPeriod] = { period: item.simulationPeriod, totalBags: 0, totalCapacity: 0, flightCount: 0, maxOccupancy: 0 };
            }
            const m = metrics[item.simulationPeriod];
            m.totalBags += item.bagsCount;
            m.totalCapacity += item.maxCapacity;
            m.flightCount += 1;
            const occ = (item.bagsCount / item.maxCapacity) * 100;
            if (occ > m.maxOccupancy) m.maxOccupancy = occ;
        });
        return Object.values(metrics);
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter((item) => {
            const matchPeriod = selectedPeriod === 'all' || item.simulationPeriod === selectedPeriod;
            const q = searchQuery.toLowerCase().trim();
            const matchSearch = q === '' || item.flightCode.toLowerCase().includes(q) || item.origin.toLowerCase().includes(q) || item.destination.toLowerCase().includes(q);
            const occPct = (item.bagsCount / item.maxCapacity) * 100;
            let matchOccupancy = true;
            if (occupancyFilter === 'normal') matchOccupancy = occPct < 80;
            else if (occupancyFilter === 'warning') matchOccupancy = occPct >= 80 && occPct <= 100;
            else if (occupancyFilter === 'critical') matchOccupancy = occPct > 100;

            return matchPeriod && matchSearch && matchOccupancy;
        }).sort((a, b) => b.bagsCount / b.maxCapacity - a.bagsCount / a.maxCapacity);
    }, [data, selectedPeriod, searchQuery, occupancyFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage]);

    const globalKpis = useMemo(() => {
        const list = selectedPeriod === 'all' ? data : data.filter((item) => item.simulationPeriod === selectedPeriod);
        let totalBags = 0, totalCapacity = 0, criticalCount = 0, warningCount = 0;
        list.forEach((item) => {
            totalBags += item.bagsCount;
            totalCapacity += item.maxCapacity;
            const rate = (item.bagsCount / item.maxCapacity) * 100;
            if (rate > 100) criticalCount++;
            else if (rate >= 80) warningCount++;
        });
        return { totalBags, totalCapacity, averageRate: totalCapacity > 0 ? (totalBags / totalCapacity) * 100 : 0, criticalCount, warningCount, totalFlights: list.length };
    }, [data, selectedPeriod]);

    const getOccupancyBadgeStyles = (percentage: number) => {
        if (percentage > 100) return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', text: 'Sobrecapacidad', barColor: 'linear-gradient(90deg, #ef4444, #f87171)' };
        if (percentage >= 80) return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', text: 'Cercano al límite', barColor: 'linear-gradient(90deg, #f59e0b, #fbbf24)' };
        return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', text: 'Óptimo', barColor: 'linear-gradient(90deg, #10b981, #34d399)' };
    };

    if (loading) {
        return <div style={{ display: 'grid', placeItems: 'center', height: '20vh' }}><h3>Cargando reporte...</h3></div>;
    }

    return (
        <div>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>{copy.title}</h2>
                    <p style={styles.subtitle}>{copy.subtitle}</p>
                    <span style={styles.stableBadge}>
                        <Lock size={12} style={{ marginRight: 4 }} />
                        {copy.badge}
                    </span>
                </div>
                <div style={styles.headerIcon}><BarChart3 size={24} color="#1b3d6b" /></div>
            </div>

            {/* KPI Cards */}
            <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                    <div style={styles.kpiHeader}>
                        <span style={styles.kpiTitle}>Ocupación Promedio</span>
                        <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(47, 98, 181, 0.1)' }}><Percent size={18} color="#2f62b5" /></div>
                    </div>
                    <div style={styles.kpiValue}>{formatPercent(globalKpis.averageRate)}</div>
                    <div style={styles.kpiFooter}>Capacidad total utilizada</div>
                </div>
                <div style={styles.kpiCard}>
                    <div style={styles.kpiHeader}>
                        <span style={styles.kpiTitle}>Equipaje Simulado</span>
                        <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}><Briefcase size={18} color="#10b981" /></div>
                    </div>
                    <div style={styles.kpiValue}>{formatInteger(globalKpis.totalBags)} <span style={styles.kpiUnit}>/ {formatInteger(globalKpis.totalCapacity)}</span></div>
                    <div style={styles.kpiFooter}>Maletas frente a capacidad</div>
                </div>
                <div style={styles.kpiCard}>
                    <div style={styles.kpiHeader}>
                        <span style={styles.kpiTitle}>Críticos (&gt;100%)</span>
                        <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}><AlertTriangle size={18} color="#ef4444" /></div>
                    </div>
                    <div style={{ ...styles.kpiValue, color: globalKpis.criticalCount > 0 ? '#ef4444' : '#0f1b2d' }}>{formatInteger(globalKpis.criticalCount)}</div>
                    <div style={styles.kpiFooter}>Superan límite de equipaje</div>
                </div>
                <div style={styles.kpiCard}>
                    <div style={styles.kpiHeader}>
                        <span style={styles.kpiTitle}>Monitoreo (Riesgo)</span>
                        <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}><TrendingUp size={18} color="#f59e0b" /></div>
                    </div>
                    <div style={styles.kpiValue}>{formatInteger(globalKpis.warningCount)}</div>
                    <div style={styles.kpiFooter}>Ocupación 80% - 100%</div>
                </div>
            </div>

            {/* Comparisons */}
            <div style={{ marginTop: '24px' }}>
                <div style={styles.sectionHeader}>
                    <Layers size={18} color="#2f62b5" />
                    <h3 style={styles.sectionTitle}>Comparación por Período</h3>
                </div>
                <div style={styles.periodBarsContainer}>
                    {periodMetrics.map((pm) => {
                        const pct = pm.totalCapacity > 0 ? (pm.totalBags / pm.totalCapacity) * 100 : 0;
                        const isSelected = selectedPeriod === pm.period;
                        return (
                            <div
                                key={pm.period}
                                style={{
                                    ...styles.periodBarItem,
                                    border: isSelected ? '1px solid #2f62b5' : '1px solid #e2e8f0',
                                    backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                                }}
                                onClick={() => setSelectedPeriod(isSelected ? 'all' : pm.period)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e3b67' }}>{pm.period}</span>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>({formatInteger(pm.flightCount)} vuelos)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '18px', color: '#1e3b67' }}>{formatPercent(pct)}</span>
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>{formatInteger(pm.totalBags)} maletas</span>
                                    </div>
                                </div>
                                <div style={styles.progressTrack}>
                                    <div
                                        style={{
                                            ...styles.progressFill,
                                            width: `${Math.min(pct, 100)}%`,
                                            background: pct > 100 ? 'linear-gradient(90deg, #ef4444, #f87171)' : pct >= 80 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #2f62b5, #57a1ff)'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div style={{ marginTop: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                    <Filter size={16} color="#64748b" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Filtros de Búsqueda</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div style={styles.filterField}>
                        <label style={styles.label}>Período</label>
                        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} style={styles.input}>
                            <option value="all">Todos los períodos</option>
                            {periods.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    {mode === 'daily' && (
                        <div style={styles.filterField}>
                            <label style={styles.label}>Fecha de Cierre Operacional *</label>
                            <input
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={(e) => setSelectedDate(e.target.value || today)}
                                style={styles.input}
                            />
                        </div>
                    )}
                    <div style={styles.filterField}>
                        <label style={styles.label}>Buscar Vuelo / Ruta</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Código, origen..." style={{ ...styles.input, paddingLeft: '32px' }} />
                        </div>
                    </div>
                    <div style={styles.filterField}>
                        <label style={styles.label}>Ocupación</label>
                        <select value={occupancyFilter} onChange={(e) => setOccupancyFilter(e.target.value as any)} style={styles.input}>
                            <option value="all">Todos los niveles</option>
                            <option value="normal">Óptimo (&lt; 80%)</option>
                            <option value="warning">Cercano al Límite (80% - 100%)</option>
                            <option value="critical">Sobrecapacidad (&gt; 100%)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', marginTop: '24px' }}>
                <table style={styles.table}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                            <th style={styles.th}>Vuelo</th>
                            <th style={styles.th}>Ruta</th>
                            <th style={styles.th}>Período</th>
                            <th style={styles.th}>Fecha</th>
                            <th style={styles.th}>Maletas vs Cap</th>
                            <th style={styles.th}>Ocupación</th>
                            <th style={styles.th}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length === 0 ? (
                            <tr><td colSpan={7} style={styles.emptyCell}>No se encontraron vuelos.</td></tr>
                        ) : (
                            paginatedData.map((item, index) => {
                                const pct = (item.bagsCount / item.maxCapacity) * 100;
                                const badge = getOccupancyBadgeStyles(pct);
                                return (
                                    <tr key={`${item.flightCode}-${index}`} style={styles.tr}>
                                        <td style={styles.td}><Plane size={14} color="#64748b" style={{ marginRight: 6 }} /><strong>{item.flightCode}</strong></td>
                                        <td style={styles.td}>{item.origin} <ChevronRight size={12} /> {item.destination}</td>
                                        <td style={styles.td}>{item.simulationPeriod}</td>
                                        <td style={styles.td}><Calendar size={13} style={{ marginRight: 6 }} />{formatDate(item.date)}</td>
                                        <td style={styles.td}><strong>{formatInteger(item.bagsCount)}</strong> <span style={{ color: '#94a3b8' }}>/ {formatInteger(item.maxCapacity)}</span></td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 600, marginRight: 8, fontSize: 13 }}>{formatPercent(pct)}</span>
                                                <div style={{ width: '80px', height: '6px', backgroundColor: '#f1f5fb', borderRadius: '999px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: badge.barColor }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: badge.bg, color: badge.color, border: badge.border }}>
                                                {pct > 100 ? <AlertCircle size={12} style={{ marginRight: 4 }} /> : pct >= 80 ? <AlertTriangle size={12} style={{ marginRight: 4 }} /> : <CheckCircle size={12} style={{ marginRight: 4 }} />}
                                                {badge.text}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d4deef', background: currentPage === 1 ? '#f7f9fc' : '#2f62b5', color: currentPage === 1 ? '#94a3b8' : '#ffffff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>← Anterior</button>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d4deef', background: currentPage === totalPages ? '#f7f9fc' : '#2f62b5', color: currentPage === totalPages ? '#94a3b8' : '#ffffff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>Siguiente →</button>
            </div>
        </div>
    );
}

const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' },
    title: { fontSize: '24px', fontWeight: 700, color: '#1b3d6b', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: '#64748b' },
    stableBadge: {
        display: 'inline-flex', alignItems: 'center', marginTop: '10px',
        padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
        backgroundColor: 'rgba(47, 98, 181, 0.1)', color: '#2f62b5', border: '1px solid rgba(47, 98, 181, 0.2)',
        letterSpacing: '0.2px',
    },
    headerIcon: { width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#e6edf7', display: 'grid', placeItems: 'center' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' },
    kpiCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' as const, gap: '8px' },
    kpiHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    kpiTitle: { fontSize: '13px', fontWeight: 600, color: '#64748b' },
    iconContainer: { width: '32px', height: '32px', borderRadius: '8px', display: 'grid', placeItems: 'center' },
    kpiValue: { fontSize: '28px', fontWeight: 700, color: '#0f1b2d' },
    kpiUnit: { fontSize: '14px', color: '#94a3b8', fontWeight: 400 },
    kpiFooter: { fontSize: '11px', color: '#94a3b8' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' },
    sectionTitle: { fontSize: '18px', fontWeight: 700, color: '#1b3d6b' },
    periodBarsContainer: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
    periodBarItem: { borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    progressTrack: { height: '10px', backgroundColor: '#f1f5fb', borderRadius: '999px', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: '999px', transition: 'width 0.5s ease-out' },
    filterField: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
    label: { fontSize: '12px', fontWeight: 600, color: '#475569' },
    input: { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', outline: 'none' },
    table: { width: '100%', borderCollapse: 'collapse' as const, textAlign: 'left' as const, fontSize: '13px' },
    th: { padding: '12px 16px', fontWeight: 600, color: '#64748b', fontSize: '12px' },
    tr: { borderBottom: '1px solid #f1f5f9' },
    td: { padding: '14px 16px', verticalAlign: 'middle' },
    emptyCell: { padding: '32px', textAlign: 'center' as const, color: '#94a3b8', fontSize: '14px' },
};