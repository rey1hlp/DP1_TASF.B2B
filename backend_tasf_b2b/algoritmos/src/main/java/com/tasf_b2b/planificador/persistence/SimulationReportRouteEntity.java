package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "simulation_report_route", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"snapshot_id", "codigo_pedido"})
})
public class SimulationReportRouteEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "snapshot_id", nullable = false)
    public Long snapshotId;

    @Column(name = "codigo_pedido", length = 40, nullable = false)
    public String codigoPedido;

    @Column(name = "estado", length = 40, nullable = false)
    public String estado;

    @Column(name = "tiempo_total_horas", nullable = false)
    public double tiempoTotalHoras;

    @Column(name = "ingreso_min", nullable = false)
    public int ingresoMin;

    @Column(name = "total_maletas")
    public Integer totalMaletas;

    @Column(name = "origen", length = 4)
    public String origen;

    @Column(name = "destino", length = 4)
    public String destino;

    @Column(name = "steps_count", nullable = false)
    public int stepsCount;

    @Column(name = "impacted", nullable = false)
    public boolean impacted;
}
