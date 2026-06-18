package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_run")
public class SimulationRunEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "simulation_id", length = 64, nullable = false, unique = true)
    public String simulationId;

    @Column(name = "tipo", length = 32, nullable = false)
    public String tipo;

    @Column(name = "inicio", length = 8)
    public String inicio;

    @Column(name = "fin", length = 8)
    public String fin;

    @Column(name = "dias")
    public Integer dias;

    @Column(name = "estado", length = 16, nullable = false)
    public String estado;

    @Column(name = "total_envios")
    public Integer totalEnvios;

    @Column(name = "total_maletas")
    public Long totalMaletas;

    @Column(name = "speed_min_per_sec")
    public Double speedMinPerSec;

    @Column(name = "creado_en", nullable = false)
    public LocalDateTime creadoEn;

    @Column(name = "finalizado_en")
    public LocalDateTime finalizadoEn;
}
