import { useState } from 'react';
import { BarChart3, Building, AlertTriangle, CalendarClock } from 'lucide-react';
import FlightOccupancyReport from './FlightOccupancyReport';
import WarehouseUtilizationReport from './WarehouseUtilizationReport';
import OperationalCollapseReport from './OperationalCollapseReport';

// Cada pestaña corresponde 1:1 a uno de los 3 escenarios de negocio, más el
// reporte auxiliar de almacenes. Los 3 escenarios muestran siempre la última
// planificación ESTABLE (el backend ya descarta los intentos intermedios).
type ReportTab = 'period' | 'daily' | 'collapse' | 'warehouse';

export default function ReportsDashboard() {
    // Estado para controlar qué pestaña está activa
    const [activeTab, setActiveTab] = useState<ReportTab>('period');

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.pageTitle}>Dashboard de Reportes</h1>
                <p style={styles.pageSubtitle}>Selecciona un reporte para visualizar la información detallada.</p>
            </div>

            {/* Selector de Pestañas (Tabs) */}
            <div style={styles.tabsContainer}>
                <button
                    onClick={() => setActiveTab('period')}
                    style={activeTab === 'period' ? styles.activeTab : styles.tab}
                >
                    <BarChart3 size={18} />
                    Escenario 1: Cierre de Periodo
                </button>

                <button
                    onClick={() => setActiveTab('daily')}
                    style={activeTab === 'daily' ? styles.activeTab : styles.tab}
                >
                    <CalendarClock size={18} />
                    Escenario 2: Cierre Diario
                </button>

                <button
                    onClick={() => setActiveTab('collapse')}
                    style={activeTab === 'collapse' ? styles.activeTab : styles.tab}
                >
                    <AlertTriangle size={18} />
                    Escenario 3: Colapso
                </button>

                <button
                    onClick={() => setActiveTab('warehouse')}
                    style={activeTab === 'warehouse' ? styles.activeTab : styles.tab}
                >
                    <Building size={18} />
                    Utilización de Almacenes
                </button>
            </div>

            {/* Contenido Dinámico (Solo renderiza el componente seleccionado) */}
            <div style={styles.contentArea}>
                {activeTab === 'period' && <FlightOccupancyReport mode="period" />}
                {activeTab === 'daily' && <FlightOccupancyReport mode="daily" />}
                {activeTab === 'collapse' && <OperationalCollapseReport />}
                {activeTab === 'warehouse' && <WarehouseUtilizationReport />}
            </div>
        </div>
    );
}

// --- Estilos ---
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '24px',
        padding: '8px',
        fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    },
    header: {
        marginBottom: '8px',
    },
    pageTitle: {
        fontSize: '28px',
        fontWeight: 700,
        color: '#1b3d6b',
        margin: '0 0 8px 0',
    },
    pageSubtitle: {
        fontSize: '15px',
        color: '#64748b',
        margin: 0,
    },
    tabsContainer: {
        display: 'flex',
        gap: '12px',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '2px',
        overflowX: 'auto' as const, // Por si en pantallas pequeñas no caben
    },
    tab: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '3px solid transparent',
        color: '#64748b',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: '-2px', // Para solapar con el borde del contenedor
    },
    activeTab: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '3px solid #2f62b5', // Color azul principal para la pestaña activa
        color: '#1b3d6b',
        fontSize: '15px',
        fontWeight: 700,
        cursor: 'pointer',
        marginBottom: '-2px',
        transition: 'all 0.2s',
    },
    contentArea: {
        minHeight: '400px', // Da un alto mínimo para que no salte mucho la UI
        animation: 'fadeIn 0.3s ease-in-out',
    },
};