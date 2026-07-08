package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DailyPlanSegmentRepository extends JpaRepository<DailyPlanSegmentEntity, Long> {

    // 1. TU MÉTODO EXISTENTE (Se queda exactamente igual para no romper tu lógica actual)
    List<DailyPlanSegmentEntity> findByPlanRunId(Long planRunId);

    // 2. EL MÉTODO ANTIGUO (Lo dejamos por si otro servicio lo utiliza)
    @Query(value = "SELECT DISTINCT f.codigo AS flightCode, dps.origen AS origin, dps.destino AS destination, " +
                   "dps.capacidad AS maxCapacity, dps.carga AS bagsCount, dpr.plan_date AS planDate " +
                   "FROM daily_plan_segment dps " +
                   "JOIN daily_plan_run dpr ON dps.plan_run_id = dpr.id " +
                   "JOIN flight f ON dps.flight_id = f.id", nativeQuery = true)
    List<Object[]> findOccupancyReportData();

    // 3. NUEVO: Obtener el reporte de cierre de TODOS los días (Última planificación estable de cada día)
    @Query(value = 
        "SELECT f.codigo, dps.origen, dps.destino, dps.capacidad, SUM(dps.carga), dpr.plan_date " +
        "FROM daily_plan_segment dps " +
        "JOIN daily_plan_run dpr ON dps.plan_run_id = dpr.id " +
        "JOIN flight f ON dps.flight_id = f.id " +
        "WHERE dpr.id IN (SELECT MAX(id) FROM daily_plan_run GROUP BY plan_date) " +
        "GROUP BY f.codigo, dps.origen, dps.destino, dps.capacidad, dpr.plan_date", 
        nativeQuery = true)
    List<Object[]> findDailyClosingReportAll();

    // 4. NUEVO: Obtener el reporte de cierre de UN DÍA en específico (Última planificación estable de ese día)
    @Query(value = 
        "SELECT f.codigo, dps.origen, dps.destino, dps.capacidad, SUM(dps.carga), dpr.plan_date " +
        "FROM daily_plan_segment dps " +
        "JOIN daily_plan_run dpr ON dps.plan_run_id = dpr.id " +
        "JOIN flight f ON dps.flight_id = f.id " +
        "WHERE dpr.id IN (SELECT MAX(id) FROM daily_plan_run WHERE plan_date = :date GROUP BY plan_date) " +
        "GROUP BY f.codigo, dps.origen, dps.destino, dps.capacidad, dpr.plan_date", 
        nativeQuery = true)
    List<Object[]> findDailyClosingReportByDate(@Param("date") String date);
}
