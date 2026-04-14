package com.tasfb2b.simulador.domain.operaciones;

import com.tasfb2b.simulador.domain.enums.TipoSimulacion;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "simulaciones")
public class Simulacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idSimulacion;

    @Column(nullable = false)
    private LocalDateTime fechaInicio;

    @Column
    private LocalDateTime fechaFin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoSimulacion tipo;

    @Column(nullable = false)
    private int tiempoProcesamiento;

    public Integer getIdSimulacion() {
        return idSimulacion;
    }

    public void setIdSimulacion(Integer idSimulacion) {
        this.idSimulacion = idSimulacion;
    }

    public LocalDateTime getFechaInicio() {
        return fechaInicio;
    }

    public void setFechaInicio(LocalDateTime fechaInicio) {
        this.fechaInicio = fechaInicio;
    }

    public LocalDateTime getFechaFin() {
        return fechaFin;
    }

    public void setFechaFin(LocalDateTime fechaFin) {
        this.fechaFin = fechaFin;
    }

    public TipoSimulacion getTipo() {
        return tipo;
    }

    public void setTipo(TipoSimulacion tipo) {
        this.tipo = tipo;
    }

    public int getTiempoProcesamiento() {
        return tiempoProcesamiento;
    }

    public void setTiempoProcesamiento(int tiempoProcesamiento) {
        this.tiempoProcesamiento = tiempoProcesamiento;
    }

    public void ejecutar() {
        if (fechaInicio == null) {
            fechaInicio = LocalDateTime.now();
        }
        fechaFin = LocalDateTime.now();
        tiempoProcesamiento = (int) Duration.between(fechaInicio, fechaFin).toMillis();
    }

    public String generarResultados() {
        return "Simulación " + idSimulacion + " completada con tipo " + tipo;
    }
}
