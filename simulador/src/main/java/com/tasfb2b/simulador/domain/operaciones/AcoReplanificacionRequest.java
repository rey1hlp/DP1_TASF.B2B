package com.tasfb2b.simulador.domain.operaciones;

import java.util.ArrayList;
import java.util.List;

public class AcoReplanificacionRequest {

    private List<String> vuelosNoDisponibles = new ArrayList<>();
    private Integer iteraciones;

    public List<String> getVuelosNoDisponibles() {
        return vuelosNoDisponibles;
    }

    public void setVuelosNoDisponibles(List<String> vuelosNoDisponibles) {
        this.vuelosNoDisponibles = vuelosNoDisponibles;
    }

    public Integer getIteraciones() {
        return iteraciones;
    }

    public void setIteraciones(Integer iteraciones) {
        this.iteraciones = iteraciones;
    }
}
