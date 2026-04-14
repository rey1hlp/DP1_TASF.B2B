package com.tasfb2b.simulador.controller.dto;

import com.tasfb2b.simulador.domain.enums.EstadoEquipaje;

import java.time.LocalDateTime;

public record EquipajeResponseDto(
        String idEnvio,
        String idCliente,
        LocalDateTime fechaRegistro,
        int cantidad,
        EstadoEquipaje estado,
        String origenCodigoOaci,
        String destinoCodigoOaci,
        PlanViajeResumenDto planViaje
) {
}
