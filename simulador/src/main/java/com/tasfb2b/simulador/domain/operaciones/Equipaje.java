package com.tasfb2b.simulador.domain.operaciones;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.tasfb2b.simulador.domain.enums.EstadoEquipaje;
import com.tasfb2b.simulador.domain.logistica.Aeropuerto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "equipajes")
public class Equipaje {

    @Id
    private String idEnvio;

    @Column(nullable = false)
    private String idCliente;

    @Column(nullable = false)
    private LocalDateTime fechaRegistro;

    @Column(nullable = false)
    private int cantidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoEquipaje estado = EstadoEquipaje.ESPERA;

    @JsonIgnoreProperties({"vuelosSalida", "vuelosLlegada"})
    @ManyToOne(optional = false)
    @JoinColumn(name = "origen_codigo_oaci", nullable = false)
    private Aeropuerto origen;

    @JsonIgnoreProperties({"vuelosSalida", "vuelosLlegada"})
    @ManyToOne(optional = false)
    @JoinColumn(name = "destino_codigo_oaci", nullable = false)
    private Aeropuerto destino;

    @OneToOne
    @JoinColumn(name = "id_plan")
    private PlanViaje planViaje;

    public String getIdEnvio() {
        return idEnvio;
    }

    public void setIdEnvio(String idEnvio) {
        this.idEnvio = idEnvio;
    }

    public String getIdCliente() {
        return idCliente;
    }

    public void setIdCliente(String idCliente) {
        this.idCliente = idCliente;
    }

    public LocalDateTime getFechaRegistro() {
        return fechaRegistro;
    }

    public void setFechaRegistro(LocalDateTime fechaRegistro) {
        this.fechaRegistro = fechaRegistro;
    }

    public int getCantidad() {
        return cantidad;
    }

    public void setCantidad(int cantidad) {
        this.cantidad = cantidad;
    }

    public EstadoEquipaje getEstado() {
        return estado;
    }

    public void setEstado(EstadoEquipaje estado) {
        this.estado = estado;
    }

    public Aeropuerto getOrigen() {
        return origen;
    }

    public void setOrigen(Aeropuerto origen) {
        this.origen = origen;
    }

    public Aeropuerto getDestino() {
        return destino;
    }

    public void setDestino(Aeropuerto destino) {
        this.destino = destino;
    }

    public PlanViaje getPlanViaje() {
        return planViaje;
    }

    public void setPlanViaje(PlanViaje planViaje) {
        this.planViaje = planViaje;
    }

    public void actualizarEstado(EstadoEquipaje nuevoEstado) {
        this.estado = nuevoEstado;
    }
}
