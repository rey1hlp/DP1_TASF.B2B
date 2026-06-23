import React, { useState, useMemo, useEffect } from 'react';
import {
  Plane,
  Layers,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Filter,
  Search,
  Briefcase,
  Percent,
  ChevronRight,
  Calendar,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchOccupancyReport } from '../services/api';

// --- Types ---
export interface FlightOccupancyData {
  flightCode: string;
  origin: string;
  destination: string;
  maxCapacity: number;
  bagsCount: number;
  simulationPeriod: string;
  date: string;
}


// --- Componente de sección colapsable (definido fuera para reutilización) ---
const CollapsibleSection = ({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => {
  return (
    <div style={styles.sectionCard}>
      <div
        style={styles.sectionHeaderClickable}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        <span style={styles.sectionTitle}>{title}</span>
        {isOpen ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
      </div>
      {isOpen && <div style={styles.sectionContent}>{children}</div>}
    </div>
  );
};

export default function OccupancyReport() {
  // --- States ---

  const [data, setData] = useState<FlightOccupancyData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'normal' | 'warning' | 'critical'>('all');

  // --- Secciones expandidas ---
  const [expandedSections, setExpandedSections] = useState({
    occupancy: true,
    warehouse: false,
    collapse: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPeriod, searchQuery, occupancyFilter]);

  // --- Fetch Data ---
  useEffect(() => {
    fetchOccupancyReport()
      .then(setData)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  // --- Periods ---
  const periods = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => set.add(item.simulationPeriod));
    return Array.from(set);
  }, [data]);

  // --- Period Metrics ---
  const periodMetrics = useMemo(() => {
    const metrics: Record<
      string,
      { period: string; totalBags: number; totalCapacity: number; flightCount: number; maxOccupancy: number }
    > = {};

    data.forEach((item) => {
      if (!metrics[item.simulationPeriod]) {
        metrics[item.simulationPeriod] = {
          period: item.simulationPeriod,
          totalBags: 0,
          totalCapacity: 0,
          flightCount: 0,
          maxOccupancy: 0,
        };
      }

      const m = metrics[item.simulationPeriod];
      m.totalBags += item.bagsCount;
      m.totalCapacity += item.maxCapacity;
      m.flightCount += 1;

      const occ = (item.bagsCount / item.maxCapacity) * 100;
      if (occ > m.maxOccupancy) {
        m.maxOccupancy = occ;
      }
    });

    return Object.values(metrics);
  }, [data]);

  // --- Filtered Data (sorted by occupancy desc) ---
  const filteredData = useMemo(() => {
    const filtered = data.filter((item) => {
      const matchPeriod = selectedPeriod === 'all' || item.simulationPeriod === selectedPeriod;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        item.flightCode.toLowerCase().includes(q) ||
        item.origin.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q);

      const occupancyPercentage = (item.bagsCount / item.maxCapacity) * 100;
      let matchOccupancy = true;
      if (occupancyFilter === 'normal') {
        matchOccupancy = occupancyPercentage < 80;
      } else if (occupancyFilter === 'warning') {
        matchOccupancy = occupancyPercentage >= 80 && occupancyPercentage <= 100;
      } else if (occupancyFilter === 'critical') {
        matchOccupancy = occupancyPercentage > 100;
      }

      return matchPeriod && matchSearch && matchOccupancy;
    });

    return filtered.sort((a, b) => b.bagsCount / b.maxCapacity - a.bagsCount / a.maxCapacity);
  }, [data, selectedPeriod, searchQuery, occupancyFilter]);

  // --- Paginated Data ---
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  // --- General KPI calculations ---
  const globalKpis = useMemo(() => {
    const list =
      selectedPeriod === 'all'
        ? data
        : data.filter((item) => item.simulationPeriod === selectedPeriod);

    let totalBags = 0;
    let totalCapacity = 0;
    let criticalCount = 0;
    let warningCount = 0;

    list.forEach((item) => {
      totalBags += item.bagsCount;
      totalCapacity += item.maxCapacity;
      const rate = (item.bagsCount / item.maxCapacity) * 100;
      if (rate > 100) {
        criticalCount++;
      } else if (rate >= 80) {
        warningCount++;
      }
    });

    const averageRate = totalCapacity > 0 ? (totalBags / totalCapacity) * 100 : 0;

    return {
      totalBags,
      totalCapacity,
      averageRate,
      criticalCount,
      warningCount,
      totalFlights: list.length,
    };
  }, [data, selectedPeriod]);

  // Aux logic for colors
  const getOccupancyBadgeStyles = (percentage: number) => {
    if (percentage > 100) {
      return {
        bg: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        text: 'Sobrecapacidad',
        barColor: 'linear-gradient(90deg, #ef4444, #f87171)',
      };
    }
    if (percentage >= 80) {
      return {
        bg: 'rgba(245, 158, 11, 0.1)',
        color: '#f59e0b',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        text: 'Cercano al límite',
        barColor: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
      };
    }
    return {
      bg: 'rgba(16, 185, 129, 0.1)',
      color: '#10b981',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      text: 'Óptimo',
      barColor: 'linear-gradient(90deg, #10b981, #34d399)',
    };
  };

  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'grid', placeItems: 'center', height: '50vh' }}>
        <h3 style={styles.title}>Cargando reporte de ocupación...</h3>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* SECCIÓN 1: OCUPACIÓN HISTÓRICA */}
      <CollapsibleSection
        title="📊 Reporte de Ocupación Histórica por Vuelo"
        isOpen={expandedSections.occupancy}
        onToggle={() => toggleSection('occupancy')}
      >
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Reporte de Ocupación Histórica</h2>
            <p style={styles.subtitle}>
              Relación de maletas transportadas vs. capacidad máxima por periodo de simulación.
            </p>
          </div>
          <div style={styles.headerIcon}>
            <BarChart3 size={24} color="#1b3d6b" />
          </div>
        </div>

        {/* KPI Cards */}
        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiHeader}>
              <span style={styles.kpiTitle}>Ocupación Promedio</span>
              <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(47, 98, 181, 0.1)' }}>
                <Percent size={18} color="#2f62b5" />
              </div>
            </div>
            <div style={styles.kpiValue}>{globalKpis.averageRate.toFixed(1)}%</div>
            <div style={styles.kpiFooter}>Capacidad total utilizada en vuelos seleccionados</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiHeader}>
              <span style={styles.kpiTitle}>Equipaje Simulado</span>
              <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <Briefcase size={18} color="#10b981" />
              </div>
            </div>
            <div style={styles.kpiValue}>
              {globalKpis.totalBags.toLocaleString()}{' '}
              <span style={styles.kpiUnit}>/ {globalKpis.totalCapacity.toLocaleString()}</span>
            </div>
            <div style={styles.kpiFooter}>Maletas asignadas frente al límite de bodega</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiHeader}>
              <span style={styles.kpiTitle}>Vuelos Críticos (&gt;100%)</span>
              <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <AlertTriangle size={18} color="#ef4444" />
              </div>
            </div>
            <div
              style={{
                ...styles.kpiValue,
                color: globalKpis.criticalCount > 0 ? '#ef4444' : '#0f1b2d',
              }}
            >
              {globalKpis.criticalCount}
            </div>
            <div style={styles.kpiFooter}>Vuelos que superan el límite de equipaje establecido</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiHeader}>
              <span style={styles.kpiTitle}>Monitoreo General</span>
              <div style={{ ...styles.iconContainer, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                <TrendingUp size={18} color="#f59e0b" />
              </div>
            </div>
            <div style={styles.kpiValue}>
              {globalKpis.warningCount} <span style={styles.kpiUnit}>en riesgo</span>
            </div>
            <div style={styles.kpiFooter}>Vuelos con ocupación entre el 80% y el 100%</div>
          </div>
        </div>

        {/* Grouped by Period Overview Chart */}
        <div style={{ ...styles.sectionCard, marginTop: '24px' }}>
          <div style={styles.sectionHeader}>
            <Layers size={18} color="#2f62b5" />
            <h3 style={styles.sectionTitle}>Comparación por Período de Simulación</h3>
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
                  <div style={styles.periodBarInfo}>
                    <div>
                      <span style={styles.periodName}>{pm.period}</span>
                      <span style={styles.periodSub}>({pm.flightCount} vuelos registrados)</span>
                    </div>
                    <div style={styles.periodValues}>
                      <span style={styles.periodPercent}>{pct.toFixed(1)}%</span>
                      <span style={styles.periodBags}>{pm.totalBags.toLocaleString()} maletas</span>
                    </div>
                  </div>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(pct, 100)}%`,
                        background:
                          pct > 100
                            ? 'linear-gradient(90deg, #ef4444, #f87171)'
                            : pct >= 80
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #2f62b5, #57a1ff)',
                      }}
                    />
                  </div>
                  <div style={styles.periodFooter}>
                    <span>Capacidad Total: {pm.totalCapacity.toLocaleString()}</span>
                    <span>Ocupación Máx. Individual: {pm.maxOccupancy.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter and Detail Table Section */}
        <div style={{ ...styles.sectionCard, marginTop: '24px' }}>
          <div style={styles.filtersWrapper}>
            <div style={styles.filtersHeader}>
              <Filter size={16} color="#64748b" />
              <span style={styles.filtersTitle}>Filtros de Búsqueda</span>
            </div>

            <div style={styles.filtersGrid}>
              {/* Period Filter */}
              <div style={styles.filterField}>
                <label style={styles.label}>Período de Simulación</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  style={styles.select}
                >
                  <option value="all">Todos los períodos</option>
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Input */}
              <div style={styles.filterField}>
                <label style={styles.label}>Buscar Vuelo / Ruta</label>
                <div style={styles.searchContainer}>
                  <Search size={16} color="#94a3b8" style={styles.searchIcon} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Código, origen o destino..."
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Occupancy Rate Filter */}
              <div style={styles.filterField}>
                <label style={styles.label}>Nivel de Ocupación</label>
                <select
                  value={occupancyFilter}
                  onChange={(e) => setOccupancyFilter(e.target.value as any)}
                  style={styles.select}
                >
                  <option value="all">Todos los niveles</option>
                  <option value="normal">Óptimo (&lt; 80%)</option>
                  <option value="warning">Cercano al Límite (80% - 100%)</option>
                  <option value="critical">Sobrecapacidad (&gt; 100%)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Flight Details Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.theadRow}>
                  <th style={styles.th}>Vuelo</th>
                  <th style={styles.th}>Ruta</th>
                  <th style={styles.th}>Período</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Maletas vs Capacidad</th>
                  <th style={styles.th}>Ocupación</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={styles.emptyCell}>
                      No se encontraron vuelos que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, index) => {
                    const percentage = (item.bagsCount / item.maxCapacity) * 100;
                    const badge = getOccupancyBadgeStyles(percentage);

                    return (
                      <tr
                        key={`${item.flightCode}-${item.simulationPeriod}-${index}`}
                        style={styles.tr}
                      >
                        <td style={styles.td}>
                          <div style={styles.flightCodeContainer}>
                            <Plane size={14} color="#64748b" style={{ marginRight: 6 }} />
                            <span style={styles.flightCodeText}>{item.flightCode}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.routeContainer}>
                            <span style={styles.routePill}>{item.origin}</span>
                            <ChevronRight size={12} color="#94a3b8" style={{ margin: '0 4px' }} />
                            <span style={styles.routePill}>{item.destination}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.periodCellText}>{item.simulationPeriod}</span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.dateContainer}>
                            <Calendar size={13} color="#94a3b8" style={{ marginRight: 6 }} />
                            {item.date}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.capacityText}>
                            <strong>{item.bagsCount}</strong>{' '}
                            <span style={{ color: '#94a3b8' }}>/ {item.maxCapacity}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.occupancyCellContainer}>
                            <span style={{ fontWeight: 600, marginRight: 8, fontSize: 13 }}>
                              {percentage.toFixed(1)}%
                            </span>
                            <div style={styles.tableProgressTrack}>
                              <div
                                style={{
                                  ...styles.tableProgressFill,
                                  width: `${Math.min(percentage, 100)}%`,
                                  background: badge.barColor,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: badge.border,
                            }}
                          >
                            {percentage > 100 ? (
                              <AlertCircle size={12} style={{ marginRight: 4 }} />
                            ) : percentage >= 80 ? (
                              <AlertTriangle size={12} style={{ marginRight: 4 }} />
                            ) : (
                              <CheckCircle size={12} style={{ marginRight: 4 }} />
                            )}
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

          {/* Pagination Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d4deef',
                background: currentPage === 1 ? '#f7f9fc' : '#2f62b5',
                color: currentPage === 1 ? '#94a3b8' : '#ffffff',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              ← Anterior
            </button>

            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
              Página {currentPage} de {totalPages}
              <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '8px' }}>
                ({filteredData.length} vuelo{filteredData.length !== 1 ? 's' : ''})
              </span>
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d4deef',
                background: currentPage === totalPages ? '#f7f9fc' : '#2f62b5',
                color: currentPage === totalPages ? '#94a3b8' : '#ffffff',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* SECCIÓN 2: UTILIZACIÓN DE ALMACENES */}
      <CollapsibleSection
        title="🏢 Reporte de Utilización de Almacenes"
        isOpen={expandedSections.warehouse}
        onToggle={() => toggleSection('warehouse')}
      >
        <div style={styles.placeholder}>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>Próximamente disponible</p>
          <p style={{ color: '#94a3b8' }}>
            Este reporte mostrará el pico máximo de ocupación alcanzado por cada aeropuerto durante el
            período ejecutado.
          </p>
        </div>
      </CollapsibleSection>

      {/* SECCIÓN 3: COLAPSO EN ESCENARIO 3 */}
      <CollapsibleSection
        title="⚠️ Reporte de Colapso Operativo (Escenario 3)"
        isOpen={expandedSections.collapse}
        onToggle={() => toggleSection('collapse')}
      >
        <div style={styles.placeholder}>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>Próximamente disponible</p>
          <p style={{ color: '#94a3b8' }}>
            Identificará el momento exacto y el recurso (vuelo o almacén) que provocó la saturación en
            el tercer escenario.
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// --- CSS-in-JS Styles ---
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    padding: '8px',
    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    color: '#0f1b2d',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1b3d6b',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
  },
  headerIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#e6edf7',
    display: 'grid',
    placeItems: 'center',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b',
  },
  iconContainer: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'grid',
    placeItems: 'center',
  },
  kpiValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#0f1b2d',
  },
  kpiUnit: {
    fontSize: '14px',
    color: '#94a3b8',
    fontWeight: 400,
  },
  kpiFooter: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
    border: '1px solid #e2e8f0',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  sectionHeaderClickable: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '4px 0',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1b3d6b',
  },
  sectionContent: {
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0',
    marginTop: '8px',
  },
  periodBarsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  periodBarItem: {
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  periodBarInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodName: {
    fontWeight: 700,
    fontSize: '14px',
    color: '#1e3b67',
  },
  periodSub: {
    fontSize: '11px',
    color: '#94a3b8',
    marginLeft: '6px',
  },
  periodValues: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  periodPercent: {
    fontWeight: 700,
    fontSize: '18px',
    color: '#1e3b67',
  },
  periodBags: {
    fontSize: '12px',
    color: '#64748b',
  },
  progressTrack: {
    height: '10px',
    backgroundColor: '#f1f5fb',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.5s ease-out',
  },
  periodFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#94a3b8',
  },
  filtersWrapper: {
    marginBottom: '20px',
  },
  filtersHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '14px',
  },
  filtersTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b',
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #f1f5f9',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f1b2d',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  searchContainer: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '10px',
  },
  input: {
    width: '100%',
    padding: '8px 12px 8px 32px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
    fontSize: '13px',
  },
  theadRow: {
    borderBottom: '2px solid #f1f5f9',
  },
  th: {
    padding: '12px 16px',
    fontWeight: 600,
    color: '#64748b',
    fontSize: '12px',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#f8fafc',
    },
  },
  td: {
    padding: '14px 16px',
    verticalAlign: 'middle',
  },
  flightCodeContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  flightCodeText: {
    fontWeight: 700,
    color: '#1e3b67',
  },
  routeContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  routePill: {
    backgroundColor: '#f1f5fb',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: 600,
    color: '#1e3b67',
    fontSize: '11px',
  },
  periodCellText: {
    color: '#475569',
    fontWeight: 500,
  },
  dateContainer: {
    display: 'flex',
    alignItems: 'center',
    color: '#64748b',
  },
  capacityText: {
    fontSize: '13px',
  },
  occupancyCellContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  tableProgressTrack: {
    width: '80px',
    height: '6px',
    backgroundColor: '#f1f5fb',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  tableProgressFill: {
    height: '100%',
    borderRadius: '999px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  emptyCell: {
    padding: '32px',
    textAlign: 'center' as const,
    color: '#94a3b8',
    fontSize: '14px',
  },
  placeholder: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
};
