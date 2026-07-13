package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "simulation_report_metric", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"snapshot_id", "metric_key"})
})
public class SimulationReportMetricEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "snapshot_id", nullable = false)
    public Long snapshotId;

    @Column(name = "metric_key", length = 80, nullable = false)
    public String metricKey;

    @Column(name = "metric_label", length = 120, nullable = false)
    public String metricLabel;

    @Column(name = "metric_value")
    public Double metricValue;

    @Column(name = "metric_text", length = 160)
    public String metricText;
}
