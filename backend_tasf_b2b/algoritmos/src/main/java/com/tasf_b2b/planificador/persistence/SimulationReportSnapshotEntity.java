package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_report_snapshot", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"simulation_id", "version_number"})
})
public class SimulationReportSnapshotEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "simulation_run_id", nullable = false)
    public Long simulationRunId;

    @Column(name = "simulation_id", length = 64, nullable = false)
    public String simulationId;

    @Column(name = "version_number", nullable = false)
    public int versionNumber;

    @Column(name = "inicio", length = 8)
    public String inicio;

    @Column(name = "fin", length = 8)
    public String fin;

    @Column(name = "dia_min")
    public Integer diaMin;

    @Column(name = "dia_max")
    public Integer diaMax;

    @Column(name = "dias_extra")
    public Integer diasExtra;

    @Column(name = "total_envios", nullable = false)
    public int totalEnvios;

    @Column(name = "total_maletas", nullable = false)
    public long totalMaletas;

    @Column(name = "speed_min_per_sec")
    public Double speedMinPerSec;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
