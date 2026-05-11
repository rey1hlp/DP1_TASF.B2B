package com.tasf_b2b.planificador.nucleo;

public class ParametrosAco {
    // Cuantas hormigas (soluciones candidatas) se generan por iteracion
    public int numeroHormigas = 100;

    // Cuantas iteraciones de aprendizaje de feromonas se ejecutan
    public int maxIteraciones = 300;

    // Peso de la feromona en la probabilidad de escoger un vuelo
    public double alpha = 0.7;

    // Peso de la heuristica (tiempo estimado) en la seleccion de vuelos
    public double beta = 2.5;

    // Tasa de evaporacion de feromonas por iteracion
    public double evaporacion = 0.25;

    // Intensidad base de deposito de feromonas
    public double q = 1000.0;

    // Maximo de saltos (vuelos) permitidos por ruta
    public int maxEscalas = 12;

    // Penalidad por romper SLA
    public double penalidadSLA = 15_000.0;

    // Penalidad adicional por cada hora de retraso sobre el SLA
    public double penalidadHoraRetraso = 250.0;

    // Penalidad por no encontrar ruta
    public double penalidadSinRuta = 1_000_000.0;

    // Penalizaciones fijas por violacion de capacidad
    public double penalidadCapVuelo = 12_000.0;
    public double penalidadCapAlmacen = 12_000.0;

    // Peso del tiempo total en el fitness (calidad base)
    public double pesoTiempo = 1.0;

    // Penalizacion por numero de vuelos
    public double pesoEscalas = 5.0;

    // Minimo de minutos entre vuelos (escala) y tiempo de recojo final
    public int minEscalaMin = 10;
    public int minRecojoMin = 10;

    // Control de logging por iteración
    public boolean logIteraciones = true;
    public int logCada = 10;

    // Tiempo maximo de ejecucion en milisegundos (0 = sin limite)
    public long maxTiempoMs = 0;

    // Parametros de reparacion local del mejor individuo
    public boolean usarReparacion = true;
    public int intervaloReparacion = 5;
    public int maxEnviosARreparar = 64;
    public int intentosReparacionPorEnvio = 12;
}
