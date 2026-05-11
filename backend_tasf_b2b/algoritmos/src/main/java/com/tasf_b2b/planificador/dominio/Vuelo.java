package com.tasf_b2b.planificador.dominio;

public class Vuelo {
    public final int id;
    public final int idPlan;
    public final String origen;
    public final String destino;
    public final int salidaMin;   // minutos absolutos desde epoch (o minutos del plan si no hay fecha)
    public final int llegadaMin;  // minutos absolutos desde epoch (o minutos del plan si no hay fecha)
    public final int diaIndex;    // dias desde epoch, -1 si no aplica
    public final String fecha;    // yyyymmdd, null si no aplica
    public int capacidad;         // mutable: se consume al asignar
    public final double horasDuracion;

    public Vuelo(int id, String origen, String destino, int salidaMin, int llegadaMin, int capacidad) {
        this(id, origen, destino, salidaMin, llegadaMin, capacidad, -1, null, id);
    }

    public Vuelo(int id, String origen, String destino, int salidaMin, int llegadaMin, int capacidad,
                 int diaIndex, String fecha, int idPlan) {
        this.id = id;
        this.idPlan = idPlan;
        this.origen = origen;
        this.destino = destino;
        this.salidaMin = salidaMin;
        this.llegadaMin = llegadaMin;
        this.capacidad = capacidad;
        this.diaIndex = diaIndex;
        this.fecha = fecha;
        int durMin;
        if (diaIndex >= 0) {
            durMin = Math.max(0, llegadaMin - salidaMin);
        } else {
            durMin = (llegadaMin >= salidaMin) ? (llegadaMin - salidaMin) : (llegadaMin + 24*60 - salidaMin);
        }
        this.horasDuracion = Math.max(0.01, durMin / 60.0);
    }

    @Override
    public String toString() {
        return String.format("Vuelo[%d] %s→%s (%.1fh)", id, origen, destino, horasDuracion);
    }
}