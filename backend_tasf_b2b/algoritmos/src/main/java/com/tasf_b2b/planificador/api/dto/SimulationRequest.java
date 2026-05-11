package com.tasf_b2b.planificador.api.dto;

public class SimulationRequest {
    public String envios;
    public String inicio;
    public String fin;
    public Integer dias;
    public Integer maxEnvios;

    public Integer poblacion;
    public Integer generaciones;
    public Double cruce;
    public Double mutacion;
    public Integer torneo;

    public Integer hilos;
    public Boolean paralelo;
    public Integer estancamiento;
    public Long maxTiempoMs;

    public Boolean buscarColapso;
    public Boolean reporte;
    public Integer diasExtra;

    public Double speedMinPerSec;
}
