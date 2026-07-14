package com.tasf_b2b.planificador.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SimulationReportImpactRepository extends JpaRepository<SimulationReportImpactEntity, Long> {
    @Query("""
        select i
        from SimulationReportImpactEntity i
        where i.snapshotId = :snapshotId
          and (:type is null or :type = '' or lower(i.impactType) = lower(:type))
        order by i.codigoPedido
        """)
    Page<SimulationReportImpactEntity> search(
        @Param("snapshotId") Long snapshotId,
        @Param("type") String type,
        Pageable pageable
    );

    List<SimulationReportImpactEntity> findBySnapshotIdOrderByCodigoPedido(Long snapshotId);

    @Query("select i.impactType, count(i) from SimulationReportImpactEntity i where i.snapshotId = :snapshotId group by i.impactType")
    List<Object[]> countByType(@Param("snapshotId") Long snapshotId);
}
