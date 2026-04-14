package com.tasfb2b.simulador.controller.dto;

import java.time.LocalDateTime;
import java.util.List;

public record PlanViajeResponseDto(
        Integer idPlan,
        LocalDateTime tiempoEstimadoLlegada,
        boolean slaCumplido,
        List<String> vuelos
) {
}
