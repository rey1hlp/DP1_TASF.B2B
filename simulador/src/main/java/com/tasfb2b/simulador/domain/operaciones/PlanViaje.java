package com.tasfb2b.simulador.domain.operaciones;

import com.tasfb2b.simulador.domain.logistica.Vuelo;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Entity
@Table(name = "planes_viaje")
public class PlanViaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idPlan;

    @Column(nullable = false)
    private LocalDateTime tiempoEstimadoLlegada;

    @Column(nullable = false)
    private boolean slaCumplido;

    @ManyToMany(cascade = {CascadeType.MERGE, CascadeType.PERSIST})
    @JoinTable(
            name = "plan_viaje_vuelos",
            joinColumns = @JoinColumn(name = "id_plan"),
            inverseJoinColumns = @JoinColumn(name = "id_vuelo")
    )
    private List<Vuelo> vuelos = new ArrayList<>();

    public Integer getIdPlan() {
        return idPlan;
    }

    public void setIdPlan(Integer idPlan) {
        this.idPlan = idPlan;
    }

    public LocalDateTime getTiempoEstimadoLlegada() {
        return tiempoEstimadoLlegada;
    }

    public void setTiempoEstimadoLlegada(LocalDateTime tiempoEstimadoLlegada) {
        this.tiempoEstimadoLlegada = tiempoEstimadoLlegada;
    }

    public boolean isSlaCumplido() {
        return slaCumplido;
    }

    public void setSlaCumplido(boolean slaCumplido) {
        this.slaCumplido = slaCumplido;
    }

    public List<Vuelo> getVuelos() {
        return vuelos;
    }

    public void setVuelos(List<Vuelo> vuelos) {
        this.vuelos = vuelos;
    }

    public Duration calcularTiempoTotal() {
        if (vuelos.isEmpty()) {
            return Duration.ZERO;
        }
        LocalDateTime salidaMinima = vuelos.stream()
                .map(Vuelo::getHoraSalida)
                .min(Comparator.naturalOrder())
                .orElse(tiempoEstimadoLlegada);
        return Duration.between(salidaMinima, tiempoEstimadoLlegada);
    }
}
