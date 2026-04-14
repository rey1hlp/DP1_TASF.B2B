package com.tasfb2b.simulador.controller.mapper;

import com.tasfb2b.simulador.controller.dto.PlanViajeResponseDto;
import com.tasfb2b.simulador.domain.operaciones.PlanViaje;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PlanViajeMapper {

    public PlanViajeResponseDto toResponse(PlanViaje planViaje) {
        List<String> vuelos = planViaje.getVuelos() == null
                ? List.of()
                : planViaje.getVuelos().stream().map(v -> v.getIdVuelo()).toList();
        return new PlanViajeResponseDto(
                planViaje.getIdPlan(),
                planViaje.getTiempoEstimadoLlegada(),
                planViaje.isSlaCumplido(),
                vuelos
        );
    }
}
