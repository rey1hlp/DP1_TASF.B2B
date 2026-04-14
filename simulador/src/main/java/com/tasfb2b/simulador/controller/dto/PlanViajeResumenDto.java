package com.tasfb2b.simulador.controller.dto;

import java.time.LocalDateTime;
import java.util.List;

public record PlanViajeResumenDto(
        Integer idPlan,
        LocalDateTime tiempoEstimadoLlegada,
        boolean slaCumplido,
        List<String> vuelos
) {
}
