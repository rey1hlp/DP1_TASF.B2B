export default function WarehouseUtilizationReport() {
    return (
        <div style={styles.placeholder}>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>Próximamente disponible</p>
            <p style={{ color: '#94a3b8' }}>
                Este reporte mostrará el pico máximo de ocupación alcanzado por cada aeropuerto durante el
                período ejecutado.
            </p>
        </div>
    );
}

const styles = {
    placeholder: {
        padding: '40px 20px',
        textAlign: 'center' as const,
        color: '#64748b',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
};