package com.tasf_b2b.planificador.dominio;

public class Aeropuerto {

    public final String codigoOaci;
    public final String nombre;
    public final String pais;
    public final String codigoCorto;
    public final int    gmt;
    public final int    capacidad;
    public final double latitud;
    public final double longitud;
    public final String continente;
    public final Almacen almacen;

    public Aeropuerto(String codigoOaci, String nombre, String pais, String codigoCorto,
                      int gmt, int capacidad, double latitud, double longitud, String continente) {
        this.codigoOaci  = codigoOaci;
        this.nombre      = nombre;
        this.pais        = pais;
        this.codigoCorto = codigoCorto;
        this.gmt         = gmt;
        this.capacidad   = capacidad;
        this.latitud     = latitud;
        this.longitud    = longitud;
        this.continente  = continente;
        this.almacen = new Almacen(codigoOaci, capacidad);
    }

    // --- Lógica de dominio ---

    /**
     * Determina si este aeropuerto y otro están en el mismo continente.
     * Reemplaza al UtilArchivos.obtenerContinente() disperso por el código.
     */
    public boolean mismoContinente(Aeropuerto otro) {
        return this.continente.equals(otro.continente);
    }

    /**
     * Calcula la distancia en km usando la fórmula Haversine.
     * Útil para el filtro de acercamiento en GrafoVuelos.
     */
    public double distanciaKm(Aeropuerto otro) {
        final double R = 6371.0;

        double dLat = Math.toRadians(otro.latitud - this.latitud);
        double dLon = Math.toRadians(otro.longitud - this.longitud);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(this.latitud))
                 * Math.cos(Math.toRadians(otro.latitud))
                 * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Devuelve el SLA en horas según si el destino es del mismo continente o no.
     * Centraliza la lógica que antes estaba duplicada en 3 lugares del planificador.
     */
    public int calcularSla(Aeropuerto destino) {
        return mismoContinente(destino) ? 24 : 48;
    }

    @Override
    public String toString() {
        return codigoOaci + " - " + nombre + " (" + pais + ")";
    }
}