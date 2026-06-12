package com.tasf_b2b.planificador.dominio;

import com.tasf_b2b.planificador.persistence.ShipmentStatus;

public class Envio {
 
    public final String idPedido;
    public final String origen;         // código OACI extraído del nombre del archivo
    public final String destino;        // código OACI destino (ej. EBCI)
    public final String fecha;          // aaaammdd
    public final int    horaIngresoLocal; // minutos desde 00:00 hora LOCAL del origen
    public final int    horaIngresoMin; // minutos absolutos desde epoch (UTC)
    public final int    diaIndex;       // dias desde epoch (UTC)
    public final int    cantidad;
    public final String idCliente;
    public final int    slaHoras;
    public ShipmentStatus status;
    public final int gmtOffset;
 
    /**
     * Constructor principal — requiere el aeropuerto origen para normalizar a UTC.
     */
    public Envio(String idPedido, String origen, String destino, String fecha,
                 int hh, int mm, int cantidad, String idCliente,
                 int slaHoras, Aeropuerto aeropuertoOrigen) {
 
        this.idPedido      = idPedido;
        this.origen        = origen;
        this.destino       = destino;
        this.fecha         = fecha;
        this.cantidad      = cantidad;
        this.idCliente     = idCliente;
        this.slaHoras      = slaHoras;
        this.status      = ShipmentStatus.PENDING;
        this.gmtOffset = (aeropuertoOrigen != null) ? aeropuertoOrigen.gmt : 0; 

        this.horaIngresoLocal = (hh * 60) + mm;
        int gmt = (aeropuertoOrigen != null) ? aeropuertoOrigen.gmt : 0;
        int horaIngresoUtc = horaIngresoLocal - (gmt * 60);
        int diaBase = com.tasf_b2b.planificador.utils.UtilArchivos.obtenerDiaIndex(fecha);
        int diaAjuste = Math.floorDiv(horaIngresoUtc, 24 * 60);
        int minDelDia = horaIngresoUtc - (diaAjuste * 24 * 60);
        this.diaIndex = diaBase + diaAjuste;
        this.horaIngresoMin = (this.diaIndex * 24 * 60) + minDelDia;
    }
 
    @Override
    public String toString() {
        return String.format("Envio[%s] %s→%s cant:%d", idPedido, origen, destino, cantidad);
    }
}
