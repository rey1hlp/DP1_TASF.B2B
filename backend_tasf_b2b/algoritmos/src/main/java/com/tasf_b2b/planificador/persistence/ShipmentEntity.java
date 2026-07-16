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

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "origen_id")
    public AirportEntity origen;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "destino_id")
    public AirportEntity destino;

    @Column(name = "ingreso_utc", nullable = false)
    public LocalDateTime ingresoUtc;

    @Column(name = "cantidad", nullable = false)
    public int cantidad;

    @Column(name = "id_cliente", length = 64, nullable = false)
    public String idCliente;

    @Column(name = "sla_horas", nullable = false)
    public int slaHoras;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    public ShipmentStatus status = ShipmentStatus.PENDING;

    @Column(name = "audit_date_ins", nullable = false)
    public LocalDateTime auditDateIns;

    @PrePersist
    public void onCreate() {
        if (auditDateIns == null) {
            auditDateIns = LocalDateTime.now();
        }
    }
}
