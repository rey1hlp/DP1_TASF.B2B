package com.tasfb2b.simulador.domain.logistica;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "vuelos")
public class Vuelo {

    @Id
    private String idVuelo;

    @Column(nullable = false)
    private LocalDateTime horaSalida;

    @Column(nullable = false)
    private LocalDateTime horaLlegada;

    @Column(nullable = false)
    private int capacidadMaxima;

    @Column(nullable = false)
    private int equipajeAsignado;

    @Column(nullable = false)
    private String estado;

    @JsonIgnoreProperties({"vuelosSalida", "vuelosLlegada"})
    @ManyToOne(optional = false)
    @JoinColumn(name = "origen_codigo_oaci", nullable = false)
    private Aeropuerto origen;

    @JsonIgnoreProperties({"vuelosSalida", "vuelosLlegada"})
    @ManyToOne(optional = false)
    @JoinColumn(name = "destino_codigo_oaci", nullable = false)
    private Aeropuerto destino;

    public String getIdVuelo() {
        return idVuelo;
    }

    public void setIdVuelo(String idVuelo) {
        this.idVuelo = idVuelo;
    }

    public LocalDateTime getHoraSalida() {
        return horaSalida;
    }

    public void setHoraSalida(LocalDateTime horaSalida) {
        this.horaSalida = horaSalida;
    }

    public LocalDateTime getHoraLlegada() {
        return horaLlegada;
    }

    public void setHoraLlegada(LocalDateTime horaLlegada) {
        this.horaLlegada = horaLlegada;
    }

    public int getCapacidadMaxima() {
        return capacidadMaxima;
    }

    public void setCapacidadMaxima(int capacidadMaxima) {
        this.capacidadMaxima = capacidadMaxima;
    }

    public int getEquipajeAsignado() {
        return equipajeAsignado;
    }

    public void setEquipajeAsignado(int equipajeAsignado) {
        this.equipajeAsignado = equipajeAsignado;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
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

    public boolean verificarDisponibilidad(int cantidadMaletas) {
        return equipajeAsignado + cantidadMaletas <= capacidadMaxima;
    }

    public void asignarMaleta(int cantidadMaletas) {
        if (!verificarDisponibilidad(cantidadMaletas)) {
            throw new IllegalArgumentException("No hay capacidad disponible en el vuelo");
        }
        equipajeAsignado += cantidadMaletas;
    }
}
