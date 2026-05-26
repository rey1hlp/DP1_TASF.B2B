package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlightRepository extends JpaRepository<FlightEntity, Long> {
    Page<FlightEntity> findAllByOrderByAuditDateInsDesc(Pageable pageable);

    Page<FlightEntity> findByCodigoContainingIgnoreCaseOrOrigen_CodigoOaciContainingIgnoreCaseOrDestino_CodigoOaciContainingIgnoreCase(
        String codigo,
        String origen,
        String destino,
        Pageable pageable
    );

    Page<FlightEntity> findByCodigoContainingIgnoreCaseOrOrigen_CodigoOaciContainingIgnoreCaseOrDestino_CodigoOaciContainingIgnoreCaseOrderByAuditDateInsDesc(
        String codigo,
        String origen,
        String destino,
        Pageable pageable
    );

    FlightEntity findByCodigo(String codigo);
}
