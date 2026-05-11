package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayList;
import java.util.List;

public class Ruta {
    public List<Vuelo> vuelos = new ArrayList<>();
    public double tiempoTotalHoras;
    public boolean cumpleSLA;
    public int[] llegadasAlmacenMin;
    public int[] salidasAlmacenMin;

    public Ruta(List<Vuelo> vuelos, int horaIngresoMin, int slaHoras, int minRecojoMin) {
        this.vuelos = vuelos;
        if (vuelos == null || vuelos.isEmpty()) {
            this.tiempoTotalHoras = Double.MAX_VALUE;
            this.cumpleSLA = false;
            this.llegadasAlmacenMin = new int[0];
            this.salidasAlmacenMin = new int[0];
            return;
        }

        Vuelo ultimoVuelo = vuelos.get(vuelos.size() - 1);
        int tiempoLlegada = ultimoVuelo.llegadaMin;

        int duracionMinutos = Math.max(0, tiempoLlegada - horaIngresoMin) + minRecojoMin;
        this.tiempoTotalHoras = duracionMinutos / 60.0;
        this.cumpleSLA = this.tiempoTotalHoras <= slaHoras;
        precalcularEventosAlmacen(minRecojoMin);
    }

    private void precalcularEventosAlmacen(int minRecojoMin) {
        int n = vuelos.size();
        this.llegadasAlmacenMin = new int[n];
        this.salidasAlmacenMin = new int[n];
        for (int i = 0; i < n; i++) {
            Vuelo vuelo = vuelos.get(i);
            llegadasAlmacenMin[i] = vuelo.llegadaMin;
            int salidaAlmacen = vuelo.llegadaMin + minRecojoMin;
            if (i < n - 1) {
                Vuelo siguiente = vuelos.get(i + 1);
                salidaAlmacen = Math.max(salidaAlmacen, siguiente.salidaMin);
            }
            salidasAlmacenMin[i] = salidaAlmacen;
        }
    }
}
