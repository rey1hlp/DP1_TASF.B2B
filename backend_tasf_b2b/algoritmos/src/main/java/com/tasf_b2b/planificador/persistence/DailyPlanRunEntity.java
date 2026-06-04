package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_plan_run", indexes = {
    @Index(name = "idx_daily_plan_run_date_window", columnList = "plan_date, window_start_min, created_at"),
    @Index(name = "idx_daily_plan_run_date_created", columnList = "plan_date, created_at")
})
public class DailyPlanRunEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "plan_date", length = 16, nullable = false)
    public String planDate;

    @Column(name = "window_start_min", nullable = false)
    public int windowStartMin;

    @Column(name = "window_end_min", nullable = false)
    public int windowEndMin;

    @Column(name = "trigger_type", length = 32, nullable = false)
    public String triggerType;

    @Column(name = "trigger_detail", length = 120)
    public String triggerDetail;

    @Column(name = "total_envios", nullable = false)
    public int totalEnvios;

    @Column(name = "total_maletas", nullable = false)
    public long totalMaletas;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
