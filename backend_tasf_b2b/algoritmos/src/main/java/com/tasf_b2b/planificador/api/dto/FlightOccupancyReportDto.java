package com.tasf_b2b.planificador.api.dto;

public class FlightOccupancyReportDto {
    public String flightCode;
    public String origin;
    public String destination;
    public int maxCapacity;
    public int bagsCount;
    public String simulationPeriod;
    public String date;

    // Constructor vacío requerido por Jackson
    public FlightOccupancyReportDto() {
    }

    // Constructor con parámetros para el mapeo manual
    public FlightOccupancyReportDto(String flightCode, String origin, String destination, 
                              int maxCapacity, int bagsCount, String simulationPeriod, String date) {
        this.flightCode = flightCode;
        this.origin = origin;
        this.destination = destination;
        this.maxCapacity = maxCapacity;
        this.bagsCount = bagsCount;
        this.simulationPeriod = simulationPeriod;
        this.date = date;
    }
}