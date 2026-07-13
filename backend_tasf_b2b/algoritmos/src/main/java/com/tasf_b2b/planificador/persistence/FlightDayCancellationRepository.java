package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FlightDayCancellationRepository extends JpaRepository<FlightDayCancellationEntity, Long> {
    boolean existsByFlightIdAndFechaCancelacion(Long flightId, LocalDate fecha);
    Optional<FlightDayCancellationEntity> findByFlightIdAndFechaCancelacion(Long flightId, LocalDate fecha);
    List<FlightDayCancellationEntity> findByFlightId(Long flightId);
    List<FlightDayCancellationEntity> findByFechaCancelacionBetween(LocalDate inicio, LocalDate fin);
}
