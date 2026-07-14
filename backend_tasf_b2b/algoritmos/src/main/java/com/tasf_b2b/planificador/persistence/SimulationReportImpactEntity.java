package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "simulation_report_impact")
public class SimulationReportImpactEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "snapshot_id", nullable = false)
    public Long snapshotId;

    @Column(name = "codigo_pedido", length = 40, nullable = false)
    public String codigoPedido;

    @Column(name = "impact_type", length = 40, nullable = false)
    public String impactType;

    @Column(name = "previous_estado", length = 40)
    public String previousEstado;

    @Column(name = "current_estado", length = 40)
    public String currentEstado;

    @Column(name = "detail", length = 255)
    public String detail;

    @Column(name = "previous_route_signature", columnDefinition = "TEXT")
    public String previousRouteSignature;

    @Column(name = "current_route_signature", columnDefinition = "TEXT")
    public String currentRouteSignature;

    @Column(name = "flight_id")
    public Long flightId;

    @Column(name = "fecha_cancelacion")
    public LocalDate fechaCancelacion;
}
