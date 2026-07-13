package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SimulationReportSnapshotRepository extends JpaRepository<SimulationReportSnapshotEntity, Long> {
    Optional<SimulationReportSnapshotEntity> findFirstBySimulationIdOrderByVersionNumberDesc(String simulationId);
}
