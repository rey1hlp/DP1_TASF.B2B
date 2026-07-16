package com.tasf_b2b.planificador.api.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.tasf_b2b.planificador.persistence.ShipmentStatus;

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
    public ShipmentStatus status;
    public LocalDateTime auditDateIns;
    public List<String> vueloIds;
}
