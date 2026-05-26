package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SimulationRunRepository extends JpaRepository<SimulationRunEntity, Long> {
    SimulationRunEntity findBySimulationId(String simulationId);

    Page<SimulationRunEntity> findByTipoContainingIgnoreCase(String tipo, Pageable pageable);
}
