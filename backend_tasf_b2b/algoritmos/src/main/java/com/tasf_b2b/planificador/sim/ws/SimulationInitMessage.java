package com.tasf_b2b.planificador.sim.ws;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;

import java.util.List;

public class SimulationInitMessage {
    public String type = "init";
    public String simulationId;
    public String inicio;
    public String inicioLocal;
    public String inicioUtc;
    public Integer inicioUtcMinute;
    public String fin;
    public int diaMin;
    public int diaMax;
    public int diasExtra;
    public int totalEnvios;
    public long totalMaletas;
    public double speedMinPerSec;
    public List<FlightSegmentDto> vuelos;
    public List<WarehouseStatusDto> almacenes;
}
