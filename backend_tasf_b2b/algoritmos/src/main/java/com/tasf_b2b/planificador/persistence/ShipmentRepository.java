package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {
    Page<ShipmentEntity> findAllByOrderByAuditDateInsDesc(Pageable pageable);

    ShipmentEntity findByCodigoPedido(String codigoPedido);

    @Query("""
        select s from ShipmentEntity s
        where lower(s.codigoPedido) like lower(concat('%', :query, '%'))
           or lower(s.origen.codigoOaci) like lower(concat('%', :query, '%'))
           or lower(s.destino.codigoOaci) like lower(concat('%', :query, '%'))
        order by s.auditDateIns desc
        """)
    Page<ShipmentEntity> searchOrderByAuditDateInsDesc(@Param("query") String query, Pageable pageable);
}
