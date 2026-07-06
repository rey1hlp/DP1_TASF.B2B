package com.tasf_b2b.planificador.api.dto;

public class EnvioDetalleDto {
    private String codigoPedido;
    private String origen;
    private String destino;
    private String ut;
    private int cantidadMaletas;
    private String estado;
    private Integer minutoEntrega;

    public EnvioDetalleDto() {}

    public EnvioDetalleDto(String codigoPedido, String origen, String destino, String ut, int cantidadMaletas, String estado, Integer minutoEntrega) {
        this.codigoPedido = codigoPedido;
        this.origen = origen;
        this.destino = destino;
        this.ut = ut;
        this.cantidadMaletas = cantidadMaletas;
        this.estado = estado;
        this.minutoEntrega = minutoEntrega;
    }

    public String getCodigoPedido() { return codigoPedido; }
    public void setCodigoPedido(String codigoPedido) { this.codigoPedido = codigoPedido; }
    public String getOrigen() { return origen; }
    public void setOrigen(String origen) { this.origen = origen; }
    public String getDestino() { return destino; }
    public void setDestino(String destino) { this.destino = destino; }
    public String getUt() { return ut; }
    public void setUt(String ut) { this.ut = ut; }
    public int getCantidadMaletas() { return cantidadMaletas; }
    public void setCantidadMaletas(int cantidadMaletas) { this.cantidadMaletas = cantidadMaletas; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public Integer getMinutoEntrega() { return minutoEntrega; }
    public void setMinutoEntrega(Integer minutoEntrega) { this.minutoEntrega = minutoEntrega; }
}