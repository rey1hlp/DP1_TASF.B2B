package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SimulationReportFlightSegmentRepository extends JpaRepository<SimulationReportFlightSegmentEntity, Long> {
    List<SimulationReportFlightSegmentEntity> findBySnapshotIdOrderBySalidaMinAscFlightIdAsc(Long snapshotId);
}
