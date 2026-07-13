package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_report_cancellation", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"snapshot_id", "flight_id", "fecha_cancelacion", "source_type"})
})
public class SimulationReportCancellationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "snapshot_id", nullable = false)
    public Long snapshotId;

    @Column(name = "flight_id", nullable = false)
    public Long flightId;

    @Column(name = "fecha_cancelacion", nullable = false)
    public LocalDate fechaCancelacion;

    @Column(name = "source_type", length = 16, nullable = false)
    public String sourceType;

    @Column(name = "context_minute")
    public Integer contextMinute;

    @Column(name = "reason", length = 160)
    public String reason;

    @Column(name = "flight_codigo", length = 20)
    public String flightCodigo;

    @Column(name = "origen", length = 4)
    public String origen;

    @Column(name = "destino", length = 4)
    public String destino;

    @Column(name = "salida")
    public LocalDateTime salida;

    @Column(name = "llegada")
    public LocalDateTime llegada;
}
