package com.tasfb2b.simulador.controller.mapper;

import com.tasfb2b.simulador.controller.dto.EquipajeResponseDto;
import com.tasfb2b.simulador.controller.dto.PlanViajeResumenDto;
import com.tasfb2b.simulador.domain.operaciones.Equipaje;
import com.tasfb2b.simulador.domain.operaciones.PlanViaje;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EquipajeMapper {

    public EquipajeResponseDto toResponse(Equipaje equipaje) {
        return new EquipajeResponseDto(
                equipaje.getIdEnvio(),
                equipaje.getIdCliente(),
                equipaje.getFechaRegistro(),
                equipaje.getCantidad(),
                equipaje.getEstado(),
                equipaje.getOrigen() == null ? null : equipaje.getOrigen().getCodigoOaci(),
                equipaje.getDestino() == null ? null : equipaje.getDestino().getCodigoOaci(),
                toPlanResumen(equipaje.getPlanViaje())
        );
    }

    private PlanViajeResumenDto toPlanResumen(PlanViaje plan) {
        if (plan == null) {
            return null;
        }
        List<String> vuelos = plan.getVuelos() == null
                ? List.of()
                : plan.getVuelos().stream().map(v -> v.getIdVuelo()).toList();
        return new PlanViajeResumenDto(
                plan.getIdPlan(),
                plan.getTiempoEstimadoLlegada(),
                plan.isSlaCumplido(),
                vuelos
        );
    }
}
