package com.tasfb2b.simulador.domain.operaciones;

public interface MotorMetaheuristico {

    int getTiempoEjecucionMax();

    void setTiempoEjecucionMax(int tiempoEjecucionMax);

    PlanViaje calcularRutaOptima(Equipaje equipaje, RedLogistica redLogistica);
}
