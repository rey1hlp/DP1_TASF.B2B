package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "simulation_report_route_step", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"route_id", "step_index"})
})
public class SimulationReportRouteStepEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "route_id", nullable = false)
    public Long routeId;

    @Column(name = "step_index", nullable = false)
    public int stepIndex;

    @Column(name = "vuelo_id", nullable = false)
    public int vueloId;

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

    @Column(name = "salida_almacen_destino_min", nullable = false)
    public int salidaAlmacenDestinoMin;
}
