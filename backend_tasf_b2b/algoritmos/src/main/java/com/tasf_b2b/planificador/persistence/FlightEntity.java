package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "flight")
public class FlightEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "codigo", length = 20, nullable = false, unique = true)
    public String codigo;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "origen_id")
    public AirportEntity origen;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "destino_id")
    public AirportEntity destino;

    @Column(name = "salida_utc_offset_min", nullable = false)
    public int salidaUtcOffsetMin;

    @Column(name = "duracion_min", nullable = false)
    public int duracionMin;

    @Column(name = "capacidad", nullable = false)
    public int capacidad;

    @Column(name = "cancelado", nullable = false)
    public boolean cancelado;

    @Column(name = "audit_date_ins", nullable = false)
    public LocalDateTime auditDateIns;

    @PrePersist
    public void onCreate() {
        if (auditDateIns == null) {
            auditDateIns = LocalDateTime.now();
        }
    }
}
