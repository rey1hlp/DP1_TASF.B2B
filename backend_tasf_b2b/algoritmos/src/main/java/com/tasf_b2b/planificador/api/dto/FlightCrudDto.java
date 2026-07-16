package com.tasf_b2b.planificador.api.dto;

public class FlightCrudDto {
    public Long id;
    public String codigo;
    public String origenOaci;
    public String origenCiudad;
    public String destinoOaci;
    public String destinoCiudad;
    public String salidaLocal;
    public String llegadaLocal;
    public int salidaUtcOffsetMin;
    public int duracionMin;
    public int origenGmt;
    public int destinoGmt;
    public int capacidad;
    public boolean cancelado;
}
