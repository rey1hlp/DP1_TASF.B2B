package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "shipment")
public class ShipmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "codigo_pedido", length = 40, nullable = false, unique = true)
    public String codigoPedido;

    @Column(name = "origen", length = 4, nullable = false)
    public String origen;

    @Column(name = "destino", length = 4, nullable = false)
    public String destino;

    @Column(name = "fecha", length = 8, nullable = false)
    public String fecha;

    @Column(name = "hora_ingreso_utc", nullable = false)
    public LocalDateTime ingresoUtc;

    @Column(name = "hora_ingreso_local", nullable = false)
    public LocalDateTime ingresoLocal;

    @Column(name = "gmt_offset", nullable = false)
    public int gmtOffset;

    @Column(name = "cantidad", nullable = false)
    public int cantidad;

    @Column(name = "id_cliente", length = 64, nullable = false)
    public String idCliente;

    @Column(name = "sla_horas", nullable = false)
    public int slaHoras;

    @Column(name = "asignado", nullable = false)
    public boolean asignado;

    @Column(name = "audit_date_ins", nullable = false)
    public LocalDateTime auditDateIns;

    @PrePersist
    public void onCreate() {
        if (auditDateIns == null) {
            auditDateIns = LocalDateTime.now();
        }
    }
}