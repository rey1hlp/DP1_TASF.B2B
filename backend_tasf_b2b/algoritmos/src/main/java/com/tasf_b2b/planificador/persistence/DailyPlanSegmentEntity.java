package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "daily_plan_segment", indexes = {
    @Index(name = "idx_daily_plan_segment_run", columnList = "plan_run_id")
})
public class DailyPlanSegmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "plan_run_id", nullable = false)
    public Long planRunId;

    @Column(name = "flight_id", nullable = false)
    public int flightId;

    @Column(name = "plan_id", nullable = false)
    public int planId;

    @Column(name = "origen", length = 4, nullable = false)
    public String origen;

    @Column(name = "destino", length = 4, nullable = false)
    public String destino;

    @Column(name = "salida_min", nullable = false)
    public int salidaMin;

    @Column(name = "llegada_min", nullable = false)
    public int llegadaMin;

    @Column(name = "carga", nullable = false)
    public long carga;

    @Column(name = "capacidad", nullable = false)
    public int capacidad;

    @Column(name = "origen_lat", nullable = false)
    public double origenLat;

    @Column(name = "origen_lon", nullable = false)
    public double origenLon;

    @Column(name = "destino_lat", nullable = false)
    public double destinoLat;

    @Column(name = "destino_lon", nullable = false)
    public double destinoLon;
}
