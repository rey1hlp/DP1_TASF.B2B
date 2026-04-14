package com.tasfb2b.simulador.domain.operaciones;

public class AcoPlanificacionRequest {

    private Integer hormigas;
    private Integer iteraciones;
    private Double alfa;
    private Double beta;
    private Double tasaEvaporacion;
    private Double feromonaInicial;

    public Integer getHormigas() {
        return hormigas;
    }

    public void setHormigas(Integer hormigas) {
        this.hormigas = hormigas;
    }

    public Integer getIteraciones() {
        return iteraciones;
    }

    public void setIteraciones(Integer iteraciones) {
        this.iteraciones = iteraciones;
    }

    public Double getAlfa() {
        return alfa;
    }

    public void setAlfa(Double alfa) {
        this.alfa = alfa;
    }

    public Double getBeta() {
        return beta;
    }

    public void setBeta(Double beta) {
        this.beta = beta;
    }

    public Double getTasaEvaporacion() {
        return tasaEvaporacion;
    }

    public void setTasaEvaporacion(Double tasaEvaporacion) {
        this.tasaEvaporacion = tasaEvaporacion;
    }

    public Double getFeromonaInicial() {
        return feromonaInicial;
    }

    public void setFeromonaInicial(Double feromonaInicial) {
        this.feromonaInicial = feromonaInicial;
    }
}
