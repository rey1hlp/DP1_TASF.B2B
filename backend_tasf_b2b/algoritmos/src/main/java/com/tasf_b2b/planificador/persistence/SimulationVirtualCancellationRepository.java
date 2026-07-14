package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SimulationVirtualCancellationRepository extends JpaRepository<SimulationVirtualCancellationEntity, Long> {
    boolean existsBySimulationIdAndFlightIdAndFechaCancelacion(String simulationId, Long flightId, LocalDate fecha);

    Optional<SimulationVirtualCancellationEntity> findBySimulationIdAndFlightIdAndFechaCancelacion(
        String simulationId,
        Long flightId,
        LocalDate fecha
    );

    List<SimulationVirtualCancellationEntity> findBySimulationIdOrderByFechaCancelacionAscFlightIdAsc(String simulationId);

    List<SimulationVirtualCancellationEntity> findBySimulationIdAndFechaCancelacionBetween(
        String simulationId,
        LocalDate inicio,
        LocalDate fin
    );
}
