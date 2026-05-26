package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "airport")
public class AirportEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "codigo_oaci", length = 4, nullable = false, unique = true)
    public String codigoOaci;

    @Column(name = "nombre", length = 120, nullable = false)
    public String nombre;

    @Column(name = "pais", length = 80, nullable = false)
    public String pais;

    @Column(name = "gmt", nullable = false)
    public int gmt;

    @Column(name = "capacidad", nullable = false)
    public int capacidad;

    @Column(name = "latitud", nullable = false)
    public double latitud;

    @Column(name = "longitud", nullable = false)
    public double longitud;

    @Column(name = "audit_date_ins", nullable = false)
    public LocalDateTime auditDateIns;

    @Column(name = "continente", length = 16)
    public String continente;

    @Column(name = "ciudad", length = 80)
    public String ciudad;

    @PrePersist
    public void onCreate() {
        if (auditDateIns == null) {
            auditDateIns = LocalDateTime.now();
        }
    }
}
