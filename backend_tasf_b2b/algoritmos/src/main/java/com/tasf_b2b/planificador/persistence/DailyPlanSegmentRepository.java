package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DailyPlanSegmentRepository extends JpaRepository<DailyPlanSegmentEntity, Long> {

    // 1. TU MÉTODO EXISTENTE (Se queda exactamente igual para no romper tu lógica actual)
    List<DailyPlanSegmentEntity> findByPlanRunId(Long planRunId);

    // 2. EL NUEVO MÉTODO (Agregado abajo para alimentar el reporte de ocupación)
    @Query(value = "SELECT DISTINCT f.codigo AS flightCode, dps.origen AS origin, dps.destino AS destination, " +
                   "dps.capacidad AS maxCapacity, dps.carga AS bagsCount, dpr.plan_date AS planDate " +
                   "FROM daily_plan_segment dps " +
                   "JOIN daily_plan_run dpr ON dps.plan_run_id = dpr.id " +
                   "JOIN flight f ON dps.flight_id = f.id", nativeQuery = true)
    List<Object[]> findOccupancyReportData();
}
