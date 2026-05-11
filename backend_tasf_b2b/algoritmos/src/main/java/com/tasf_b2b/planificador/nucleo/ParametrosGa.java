package com.tasf_b2b.planificador.nucleo;

public class ParametrosGa {
    public int tamanoPoblacion = 50;
    public int maxGeneraciones = 100;
    public double tasaCruce = 0.85;
    public double tasaMutacion = 0.15;
    public int tamanoTorneo = 5;

    public double penalidadSLA = 15_000.0;
    public double penalidadHoraRetraso = 250.0;
    public double penalidadSinRuta = 1_000_000.0;
    public double penalidadCapVuelo = 12_000.0;
    public double penalidadCapAlmacen = 12_000.0;

    public double pesoTiempo = 1.0;
    public double pesoEscalas = 5.0;

    public int minEscalaMin = 10;
    public int minRecojoMin = 10;

    public long maxTiempoMs = 0;
    public int maxGeneracionesSinMejora = 0;

    public boolean evaluacionParalela = true;
    public int maxHilosEvaluacion = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
    public boolean logGeneraciones = false;
    public boolean modoMasivoAdaptativo = true;
    public int umbralInstanciaMasiva = 200_000;
    public int rondasReparacionInicial = 2;
    public int maxTamPoblacionMasiva = 8;
    public int presupuestoPoblacionMb = 320;
    public int maxGenesMutacion = 128;
    public int maxGenesMutacionMasiva = 24;
    public int maxHilosMasivo = 1;

    public boolean usarReparacion = true;
    public int intervaloReparacion = 5;
    public int maxEnviosARreparar = 64;
    public int intentosReparacionPorEnvio = 12;
}
