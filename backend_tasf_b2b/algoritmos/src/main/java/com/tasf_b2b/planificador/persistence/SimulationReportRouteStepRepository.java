package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SimulationReportRouteStepRepository extends JpaRepository<SimulationReportRouteStepEntity, Long> {
    List<SimulationReportRouteStepEntity> findByRouteIdOrderByStepIndex(Long routeId);

    List<SimulationReportRouteStepEntity> findByRouteIdInOrderByRouteIdAscStepIndexAsc(Collection<Long> routeIds);
}
