package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AirportRepository extends JpaRepository<AirportEntity, Long> {
    Page<AirportEntity> findAllByOrderByAuditDateInsDesc(Pageable pageable);

    Page<AirportEntity> findByCodigoOaciContainingIgnoreCaseOrNombreContainingIgnoreCase(
        String codigoOaci,
        String nombre,
        Pageable pageable
    );

    Page<AirportEntity> findByCodigoOaciContainingIgnoreCaseOrNombreContainingIgnoreCaseOrderByAuditDateInsDesc(
        String codigoOaci,
        String nombre,
        Pageable pageable
    );

    AirportEntity findByCodigoOaci(String codigoOaci);
}
