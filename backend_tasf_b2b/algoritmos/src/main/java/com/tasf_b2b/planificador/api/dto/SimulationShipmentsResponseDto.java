package com.tasf_b2b.planificador.api.dto;

import java.util.List;

public class SimulationShipmentsResponseDto {
    private List<EnvioDetalleDto> planificados;
    private List<EnvioDetalleDto> enVuelo;
    private List<EnvioDetalleDto> entregadosRecientes;

    public SimulationShipmentsResponseDto() {}

    public SimulationShipmentsResponseDto(List<EnvioDetalleDto> planificados, List<EnvioDetalleDto> enVuelo, List<EnvioDetalleDto> entregadosRecientes) {
        this.planificados = planificados;
        this.enVuelo = enVuelo;
        this.entregadosRecientes = entregadosRecientes;
    }

    public List<EnvioDetalleDto> getPlanificados() { return planificados; }
    public void setPlanificados(List<EnvioDetalleDto> planificados) { this.planificados = planificados; }
    public List<EnvioDetalleDto> getEnVuelo() { return enVuelo; }
    public void setEnVuelo(List<EnvioDetalleDto> enVuelo) { this.enVuelo = enVuelo; }
    public List<EnvioDetalleDto> getEntregadosRecientes() { return entregadosRecientes; }
    public void setEntregadosRecientes(List<EnvioDetalleDto> entregadosRecientes) { this.entregadosRecientes = entregadosRecientes; }
}