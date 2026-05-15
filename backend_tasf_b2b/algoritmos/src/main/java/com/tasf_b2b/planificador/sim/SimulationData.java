package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;

import java.util.List;

public class SimulationData {
    public final String inicio;
    public final String fin;
    public final int diaMin;
    public final int diaMax;
    public final int diasExtra;
    public final int totalEnvios;
    public final long totalMaletas;
    public final double speedMinPerSec;
    public final List<FlightSegmentDto> vuelos;
    public final List<WarehouseStatusDto> almacenes;

    public SimulationData(
        String inicio,
        String fin,
        int diaMin,
        int diaMax,
        int diasExtra,
        int totalEnvios,
        long totalMaletas,
        double speedMinPerSec,
        List<FlightSegmentDto> vuelos,
        List<WarehouseStatusDto> almacenes
    ) {
        this.inicio = inicio;
        this.fin = fin;
        this.diaMin = diaMin;
        this.diaMax = diaMax;
        this.diasExtra = diasExtra;
        this.totalEnvios = totalEnvios;
        this.totalMaletas = totalMaletas;
        this.speedMinPerSec = speedMinPerSec;
        this.vuelos = vuelos;
        this.almacenes = almacenes;
    }
}
