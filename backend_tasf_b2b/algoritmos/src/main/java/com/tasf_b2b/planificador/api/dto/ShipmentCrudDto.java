package com.tasf_b2b.planificador.api.dto;

import java.time.LocalDateTime;

public class ShipmentCrudDto {
    public Long id;
    public String codigoPedido;
    public String origen;
    public String origenCiudad;
    public String destino;
    public String destinoCiudad;
    public String fecha;
    public LocalDateTime ingresoUtc;
    public LocalDateTime ingresoLocal;
    public int gmtOffset;
    public int cantidad;
    public String idCliente;
    public int slaHoras;
    public boolean asignado;
    public LocalDateTime auditDateIns;
}
