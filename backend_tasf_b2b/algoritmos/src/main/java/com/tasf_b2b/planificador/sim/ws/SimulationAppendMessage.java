package com.tasf_b2b.planificador.sim.ws;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;

import java.util.List;

public class SimulationAppendMessage {
    public String type = "append";
    public String simulationId;
    public String inicio;
    public String fin;
    public int diaMin;
    public int diaMax;
    public int diasExtra;
    public int totalEnvios;
    public long totalMaletas;
    public double speedMinPerSec;
    public List<FlightSegmentDto> vuelos;
    public List<WarehouseStatusDto> almacenes;
    public String message;
}
