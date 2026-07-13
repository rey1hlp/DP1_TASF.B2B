package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SimulationReportRouteRepository extends JpaRepository<SimulationReportRouteEntity, Long> {
    @Query("""
        select r
        from SimulationReportRouteEntity r
        where r.snapshotId = :snapshotId
          and (:estado is null or :estado = '' or lower(r.estado) = lower(:estado))
          and (:query is null or :query = '' or lower(r.codigoPedido) like lower(concat('%', :query, '%')))
          and (:impactedOnly = false or r.impacted = true)
        order by r.codigoPedido
        """)
    Page<SimulationReportRouteEntity> search(
        @Param("snapshotId") Long snapshotId,
        @Param("estado") String estado,
        @Param("query") String query,
        @Param("impactedOnly") boolean impactedOnly,
        Pageable pageable
    );

    Optional<SimulationReportRouteEntity> findBySnapshotIdAndCodigoPedido(Long snapshotId, String codigoPedido);

    List<SimulationReportRouteEntity> findBySnapshotIdOrderByCodigoPedido(Long snapshotId);

    List<SimulationReportRouteEntity> findTop100BySnapshotIdOrderByCodigoPedido(Long snapshotId);

    @Query("select r.estado, count(r) from SimulationReportRouteEntity r where r.snapshotId = :snapshotId group by r.estado")
    List<Object[]> countByStatus(@Param("snapshotId") Long snapshotId);

    long countBySnapshotIdAndImpactedTrue(Long snapshotId);
}
