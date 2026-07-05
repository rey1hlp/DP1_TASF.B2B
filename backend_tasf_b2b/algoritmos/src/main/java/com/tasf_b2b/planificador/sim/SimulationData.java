package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;

import java.util.List;
import java.util.Map;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;

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
    public final Map<String, RespuestaRutaEnvioDto> rutasPorPaquete;
    public final Map<String, ShipmentCrudDto> enviosPorCodigo;
    public final Map<Integer, List<ShipmentCrudDto>> enviosPorVuelo;

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
        List<WarehouseStatusDto> almacenes,
        Map<String, RespuestaRutaEnvioDto> rutasPorPaquete,
        Map<String, ShipmentCrudDto> enviosPorCodigo,
        Map<Integer, List<ShipmentCrudDto>> enviosPorVuelo
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
        this.rutasPorPaquete = rutasPorPaquete;
        this.enviosPorCodigo = enviosPorCodigo;
        this.enviosPorVuelo = enviosPorVuelo;
    }
}
