package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_virtual_cancellation", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"simulation_id", "flight_id", "fecha_cancelacion"})
})
public class SimulationVirtualCancellationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "simulation_id", length = 64, nullable = false)
    public String simulationId;

    @Column(name = "flight_id", nullable = false)
    public Long flightId;

    @Column(name = "fecha_cancelacion", nullable = false)
    public LocalDate fechaCancelacion;

    @Column(name = "context_minute")
    public Integer contextMinute;

    @Column(name = "reason", length = 160)
    public String reason;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "created_by_user_id")
    public Long createdByUserId;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
