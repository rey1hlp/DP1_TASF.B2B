package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SimulationReportMetricRepository extends JpaRepository<SimulationReportMetricEntity, Long> {
    List<SimulationReportMetricEntity> findBySnapshotIdOrderByMetricKey(Long snapshotId);
}
