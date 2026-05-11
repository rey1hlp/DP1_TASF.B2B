package com.tasf_b2b.planificador.nucleo;

public class Individuo implements Comparable<Individuo> {

    public Ruta[] asignaciones;
    public double fitness;
    public boolean fitnessValido;
    public int violSla;
    public int violCapVuelo;
    public int violCapAlmacen;
    public int sinRuta;

    public Individuo(int totalEnvios) {
        this.asignaciones = new Ruta[totalEnvios];
        this.fitness = Double.MAX_VALUE;
        this.fitnessValido = false;
        this.violSla = 0;
        this.violCapVuelo = 0;
        this.violCapAlmacen = 0;
        this.sinRuta = 0;
    }

    public Individuo clonar() {
        Individuo hijo = new Individuo(this.asignaciones.length);
        System.arraycopy(this.asignaciones, 0, hijo.asignaciones, 0, this.asignaciones.length);
        hijo.fitness = this.fitness;
        hijo.fitnessValido = this.fitnessValido;
        hijo.violSla = this.violSla;
        hijo.violCapVuelo = this.violCapVuelo;
        hijo.violCapAlmacen = this.violCapAlmacen;
        hijo.sinRuta = this.sinRuta;
        return hijo;
    }

    public boolean esFactible() {
        return sinRuta == 0 && violSla == 0 && violCapVuelo == 0 && violCapAlmacen == 0;
    }

    @Override
    public int compareTo(Individuo otro) {
        return Double.compare(this.fitness, otro.fitness);
    }
}
