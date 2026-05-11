package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Envio;

public class Asignacion {
    public Envio envio;           // El envío original
    public Ruta ruta;             // La ruta que el Algoritmo Genético le asignó
    public String estado;         // "ENTREGADO", "EN_ALMACEN" o "SIN_RUTA"
    public double retrasoHoras;   // Diferencia entre llegada y el SLA

    public Asignacion(Envio envio, Ruta ruta) {
        this.envio = envio;
        this.ruta = ruta;
        
        if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) {
            this.estado = "SIN_RUTA";
            this.retrasoHoras = 0;
        } else {
            this.estado = ruta.cumpleSLA ? "ENTREGADO" : "CON_RETRASO";
            
            // Restamos el tiempo total menos el SLA esperado. 
            // Si llegó antes (ej. 20h - 24h = -4), Math.max lo deja en 0 retraso.
            this.retrasoHoras = Math.max(0, ruta.tiempoTotalHoras - envio.slaHoras); 
        }
    }
}
