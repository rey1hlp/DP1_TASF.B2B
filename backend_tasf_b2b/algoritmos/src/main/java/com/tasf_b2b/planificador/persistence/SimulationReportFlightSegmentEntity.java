package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "simulation_report_flight_segment")
public class SimulationReportFlightSegmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "snapshot_id", nullable = false)
    public Long snapshotId;

    @Column(name = "flight_id", nullable = false)
    public int flightId;

    @Column(name = "plan_id")
    public Long planId;

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
