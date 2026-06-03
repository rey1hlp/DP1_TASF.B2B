package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {
    Page<ShipmentEntity> findAllByOrderByAuditDateInsDesc(Pageable pageable);

    ShipmentEntity findByCodigoPedido(String codigoPedido);

    Page<ShipmentEntity> findByCodigoPedidoContainingIgnoreCaseOrOrigenContainingIgnoreCaseOrDestinoContainingIgnoreCase(
        String codigoPedido,
        String origen,
        String destino,
        Pageable pageable
    );

    Page<ShipmentEntity> findByCodigoPedidoContainingIgnoreCaseOrOrigenContainingIgnoreCaseOrDestinoContainingIgnoreCaseOrderByAuditDateInsDesc(
        String codigoPedido,
        String origen,
        String destino,
        Pageable pageable
    );
}