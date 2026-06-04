package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "flight_day_cancellation", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"flight_id", "fecha_cancelacion"})
})
public class FlightDayCancellationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "flight_id", nullable = false)
    public Long flightId;

    @Column(name = "fecha_cancelacion", nullable = false)
    public LocalDate fechaCancelacion;

    @Column(name = "audit_date_ins", nullable = false)
    public LocalDateTime auditDateIns;

    @PrePersist
    public void onCreate() {
        if (auditDateIns == null) {
            auditDateIns = LocalDateTime.now();
        }
    }
}
