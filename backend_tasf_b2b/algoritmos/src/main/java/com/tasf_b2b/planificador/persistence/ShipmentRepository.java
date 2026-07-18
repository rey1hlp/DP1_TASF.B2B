package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ShipmentRepository extends JpaRepository<ShipmentEntity, Long> {
    Page<ShipmentEntity> findAllByOrderByAuditDateInsDesc(Pageable pageable);

    ShipmentEntity findByCodigoPedido(String codigoPedido);

    List<ShipmentEntity> findByCodigoPedidoIn(List<String> codigosPedido);

    @Query(
        value = """
            select coalesce(max(cast(codigo_pedido as unsigned)), 0)
            from shipment
            where codigo_pedido regexp '^[0-9]{9}$'
            """,
        nativeQuery = true
    )
    Long findMaxNumericCodigoPedido();

    @Query("""
        select s from ShipmentEntity s
        where upper(s.origen.codigoOaci) = upper(:origen)
          and upper(s.destino.codigoOaci) = upper(:destino)
        order by s.auditDateIns desc
        """)
    List<ShipmentEntity> findByRoute(
        @Param("origen") String origen,
        @Param("destino") String destino
    );

    @Query("""
        select s from ShipmentEntity s
        where lower(s.codigoPedido) like lower(concat('%', :query, '%'))
           or lower(s.origen.codigoOaci) like lower(concat('%', :query, '%'))
           or lower(s.destino.codigoOaci) like lower(concat('%', :query, '%'))
        order by s.auditDateIns desc
        """)
    Page<ShipmentEntity> searchOrderByAuditDateInsDesc(@Param("query") String query, Pageable pageable);

    @Query("""
        select s from ShipmentEntity s
        where upper(s.origen.codigoOaci) = upper(:airport)
           or upper(s.destino.codigoOaci) = upper(:airport)
        order by s.auditDateIns desc
        """)
    Page<ShipmentEntity> findVisibleForAirport(
        @Param("airport") String airport,
        Pageable pageable
    );

    @Query("""
        select s from ShipmentEntity s
        where (upper(s.origen.codigoOaci) = upper(:airport)
           or upper(s.destino.codigoOaci) = upper(:airport))
          and (
            lower(s.codigoPedido) like lower(concat('%', :query, '%'))
            or lower(s.origen.codigoOaci) like lower(concat('%', :query, '%'))
            or lower(s.destino.codigoOaci) like lower(concat('%', :query, '%'))
          )
        order by s.auditDateIns desc
        """)
    Page<ShipmentEntity> searchVisibleForAirport(
        @Param("airport") String airport,
        @Param("query") String query,
        Pageable pageable
    );
}
