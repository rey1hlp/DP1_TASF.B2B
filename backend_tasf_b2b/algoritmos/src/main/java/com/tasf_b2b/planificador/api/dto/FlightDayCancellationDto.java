package com.tasf_b2b.planificador.api.dto;

public class FlightDayCancellationDto {
    public Long flightId;
    public String fecha; // Formato YYYY-MM-DD
    public String contextDate; // Fecha simulada, opcional
    public Integer contextMinuteOfDay; // Minuto simulado del día, opcional
}
