package com.tasf_b2b.planificador.dominio;

import java.util.concurrent.atomic.AtomicInteger;

public class Almacen {

    private final String codigoAeropuerto;
    private final int    capacidadMaxima;
    private final AtomicInteger ocupacionActual = new AtomicInteger(0);

    public Almacen(String codigoAeropuerto, int capacidadMaxima) {
        this.codigoAeropuerto = codigoAeropuerto;
        this.capacidadMaxima  = capacidadMaxima;
    }

    // --- Consultas ---

    public int getOcupacionActual() {
        return ocupacionActual.get();
    }

    public int getCapacidadMaxima() {
        return capacidadMaxima;
    }

    public int getEspacioDisponible() {
        return capacidadMaxima - ocupacionActual.get();
    }

    public boolean tieneEspacio(int cantidad) {
        return ocupacionActual.get() + cantidad <= capacidadMaxima;
    }

    public double getPorcentajeOcupacion() {
        return (ocupacionActual.get() * 100.0) / capacidadMaxima;
    }

    // --- Operaciones ---

    /**
     * Intenta ingresar 'cantidad' unidades al almacén.
     * @return true si había espacio y se ingresó, false si excede la capacidad máxima.
     */
    public boolean ingresar(int cantidad) {
        // AtomicInteger para evitar race conditions si el planificador corre en paralelo
        return ocupacionActual.accumulateAndGet(cantidad, (actual, delta) -> {
            if (actual + delta > capacidadMaxima) return actual; // no modifica
            return actual + delta;
        }) != ocupacionActual.get() - cantidad || tieneEspacio(0);
    }

    /**
     * Intenta ingresar 'cantidad' unidades al almacén.
     * Versión legible con synchronized para uso simple (sin paralelismo pesado).
     */
    public synchronized boolean ingresarSync(int cantidad) {
        if (!tieneEspacio(cantidad)) return false;
        ocupacionActual.addAndGet(cantidad);
        return true;
    }

    /**
     * Retira 'cantidad' unidades del almacén (cuando el envío sale en el siguiente vuelo).
     * @throws IllegalStateException si se intenta retirar más de lo que hay.
     */
    public synchronized void retirar(int cantidad) {
        if (cantidad > ocupacionActual.get()) {
            throw new IllegalStateException(
                "Almacén " + codigoAeropuerto + ": intento de retirar " + cantidad +
                " pero solo hay " + ocupacionActual.get()
            );
        }
        ocupacionActual.addAndGet(-cantidad);
    }

    /**
     * Reinicia el almacén a 0. Útil entre ejecuciones del AG.
     */
    public void resetear() {
        ocupacionActual.set(0);
    }

    @Override
    public String toString() {
        return String.format("Almacen[%s] %d/%d (%.1f%%)",
            codigoAeropuerto, ocupacionActual.get(), capacidadMaxima, getPorcentajeOcupacion());
    }
}