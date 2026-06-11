package com.tasf_b2b.planificador.api.dto;

import java.util.List;

public class RespuestaRutaEnvioDto {
    public String codigoPedido;
    public String estado;
    public double tiempoTotalHoras;
    public List<PasoRutaDto> ruta;
}