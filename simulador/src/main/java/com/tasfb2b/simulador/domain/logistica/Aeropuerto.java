package com.tasfb2b.simulador.domain.logistica;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.tasfb2b.simulador.domain.enums.Semaforo;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "aeropuertos")
public class Aeropuerto {

    @Id
    @Column(length = 4)
    private String codigoOaci;

    @Column(nullable = false)
    private String ciudad;

    @Column(nullable = false)
    private String pais;

    @Column(nullable = false)
    private String husoHorario;

    @Column(nullable = false)
    private int aforoMaximo;

    @Column(nullable = false)
    private int ocupacionActual;

    @JsonIgnore
    @OneToMany(mappedBy = "origen")
    private List<Vuelo> vuelosSalida = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "destino")
    private List<Vuelo> vuelosLlegada = new ArrayList<>();

    public String getCodigoOaci() {
        return codigoOaci;
    }

    public void setCodigoOaci(String codigoOaci) {
        this.codigoOaci = codigoOaci;
    }

    public String getCiudad() {
        return ciudad;
    }

    public void setCiudad(String ciudad) {
        this.ciudad = ciudad;
    }

    public String getPais() {
        return pais;
    }

    public void setPais(String pais) {
        this.pais = pais;
    }

    public String getHusoHorario() {
        return husoHorario;
    }

    public void setHusoHorario(String husoHorario) {
        this.husoHorario = husoHorario;
    }

    public int getAforoMaximo() {
        return aforoMaximo;
    }

    public void setAforoMaximo(int aforoMaximo) {
        this.aforoMaximo = aforoMaximo;
    }

    public int getOcupacionActual() {
        return ocupacionActual;
    }

    public void setOcupacionActual(int ocupacionActual) {
        this.ocupacionActual = ocupacionActual;
    }

    public List<Vuelo> getVuelosSalida() {
        return vuelosSalida;
    }

    public List<Vuelo> getVuelosLlegada() {
        return vuelosLlegada;
    }

    public void actualizarOcupacion(int nuevaOcupacion) {
        this.ocupacionActual = nuevaOcupacion;
    }

    public Semaforo calcularSemaforo() {
        if (aforoMaximo <= 0) {
            return Semaforo.ROJO;
        }
        double ratio = (double) ocupacionActual / aforoMaximo;
        if (ratio < 0.7) {
            return Semaforo.VERDE;
        }
        if (ratio < 0.9) {
            return Semaforo.AMBAR;
        }
        return Semaforo.ROJO;
    }
}
