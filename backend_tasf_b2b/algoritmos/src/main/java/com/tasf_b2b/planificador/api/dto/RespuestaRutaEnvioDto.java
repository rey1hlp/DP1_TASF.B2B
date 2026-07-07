package com.tasf_b2b.planificador.api.dto;

import java.util.List;

public class RespuestaRutaEnvioDto {
    public String codigoPedido;
    public String codigoMaleta;
    public Integer numeroMaleta;
    public Integer totalMaletas;
    public boolean consultaMaleta;
    public String estado;
    public double tiempoTotalHoras;
    public int ingresoMin;
    public List<PasoRutaDto> ruta;
}
