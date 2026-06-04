package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyPlanRunRepository extends JpaRepository<DailyPlanRunEntity, Long> {
    DailyPlanRunEntity findTopByPlanDateAndWindowStartMinOrderByCreatedAtDesc(String planDate, int windowStartMin);

    DailyPlanRunEntity findTopByPlanDateOrderByCreatedAtDesc(String planDate);

    @Query(value = """
        select *
        from daily_plan_run r
        where r.plan_date = :planDate
          and (
               (r.window_end_min <= 1440 and r.window_start_min <= :minute and :minute <= r.window_end_min)
            or (r.window_end_min > 1440 and (:minute >= r.window_start_min or :minute <= (r.window_end_min - 1440)))
          )
        order by r.created_at desc
        limit 1
        """, nativeQuery = true)
    DailyPlanRunEntity findLatestCoveringMinute(@Param("planDate") String planDate, @Param("minute") int minute);
}
