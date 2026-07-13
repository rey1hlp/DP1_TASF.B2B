package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SimulationReportCancellationRepository extends JpaRepository<SimulationReportCancellationEntity, Long> {
    List<SimulationReportCancellationEntity> findBySnapshotIdOrderByFechaCancelacionAscFlightIdAsc(Long snapshotId);
}
