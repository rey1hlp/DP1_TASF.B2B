package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DailyPlanSegmentRepository extends JpaRepository<DailyPlanSegmentEntity, Long> {
    List<DailyPlanSegmentEntity> findByPlanRunId(Long planRunId);
}
