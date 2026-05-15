package com.tasf_b2b.planificador.api.dto;

import java.util.List;

public class WarehouseStatusDto {
    public String codigoOaci;
    public int capacidad;
    public List<WarehouseEventDto> eventos;
}
