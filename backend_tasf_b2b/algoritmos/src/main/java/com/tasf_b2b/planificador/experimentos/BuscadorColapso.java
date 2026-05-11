package com.tasf_b2b.planificador.experimentos;

import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;
import com.tasf_b2b.planificador.nucleo.GrafoVuelos;
import com.tasf_b2b.planificador.nucleo.Individuo;
import com.tasf_b2b.planificador.nucleo.ObjetivoConfig;
import com.tasf_b2b.planificador.nucleo.ParametrosGa;
import com.tasf_b2b.planificador.nucleo.PlanificadorGa;
import com.tasf_b2b.planificador.utils.UtilArchivos;

import java.util.List;
import java.util.Map;

public final class BuscadorColapso {
    private BuscadorColapso() {
    }

    public static ResultadoVentana buscarPuntoColapso(
        List<Envio> enviosOrdenados,
        Map<String, Aeropuerto> aeropuertos,
        List<Vuelo> planes,
        int diasExtra,
        ParametrosGa baseParams,
        long semilla
    ) {
        List<Integer> dias = enviosOrdenados.stream().map(e -> e.diaIndex).distinct().toList();
        if (dias.isEmpty()) {
            return new ResultadoVentana(enviosOrdenados, 0, 0, 0L, false);
        }

        int low = 0;
        int high = dias.size() - 1;
        ResultadoVentana mejorFactible = null;
        ResultadoVentana mejorInviable = null;

        while (low <= high) {
            int mid = (low + high) >>> 1;
            int diaFin = dias.get(mid);
            int limite = upperBoundDia(enviosOrdenados, diaFin);
            List<Envio> subset = new java.util.ArrayList<>(enviosOrdenados.subList(0, limite));
            long maletas = subset.stream().mapToLong(e -> e.cantidad).sum();

            ResultadoVentana evaluacion = evaluarVentana(
                subset,
                aeropuertos,
                planes,
                diasExtra,
                baseParams,
                semilla,
                maletas
            );

            if (evaluacion.factible) {
                mejorFactible = evaluacion;
                low = mid + 1;
            } else {
                mejorInviable = evaluacion;
                high = mid - 1;
            }
        }

        return mejorFactible != null ? mejorFactible : mejorInviable;
    }

    private static ResultadoVentana evaluarVentana(
        List<Envio> envios,
        Map<String, Aeropuerto> aeropuertos,
        List<Vuelo> planes,
        int diasExtra,
        ParametrosGa baseParams,
        long semilla,
        long totalMaletas
    ) {
        int diaMin = envios.stream().mapToInt(e -> e.diaIndex).min().orElse(0);
        int diaMax = envios.stream().mapToInt(e -> e.diaIndex).max().orElse(diaMin);
        List<Vuelo> vuelos = new UtilArchivos().instanciarVuelosPorRango(planes, diaMin, diaMax + Math.max(0, diasExtra));
        GrafoVuelos grafo = new GrafoVuelos(vuelos, aeropuertos);

        ParametrosGa params = copiarParams(baseParams);
        ObjetivoConfig.aplicar(params);

        Individuo mejor = new PlanificadorGa(grafo, envios, params, semilla).ejecutar();
        boolean factible = mejor.esFactible();
        return new ResultadoVentana(envios, diaMin, diaMax, totalMaletas, factible);
    }

    private static int upperBoundDia(List<Envio> envios, int diaFin) {
        int lo = 0;
        int hi = envios.size();
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (envios.get(mid).diaIndex <= diaFin) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    private static ParametrosGa copiarParams(ParametrosGa base) {
        ParametrosGa p = new ParametrosGa();
        p.tamanoPoblacion = base.tamanoPoblacion;
        p.maxGeneraciones = base.maxGeneraciones;
        p.tasaCruce = base.tasaCruce;
        p.tasaMutacion = base.tasaMutacion;
        p.tamanoTorneo = base.tamanoTorneo;
        p.maxTiempoMs = base.maxTiempoMs;
        p.maxGeneracionesSinMejora = base.maxGeneracionesSinMejora;
        p.evaluacionParalela = base.evaluacionParalela;
        p.maxHilosEvaluacion = base.maxHilosEvaluacion;
        p.logGeneraciones = base.logGeneraciones;
        p.modoMasivoAdaptativo = base.modoMasivoAdaptativo;
        p.umbralInstanciaMasiva = base.umbralInstanciaMasiva;
        p.rondasReparacionInicial = base.rondasReparacionInicial;
        p.maxTamPoblacionMasiva = base.maxTamPoblacionMasiva;
        p.presupuestoPoblacionMb = base.presupuestoPoblacionMb;
        p.maxGenesMutacion = base.maxGenesMutacion;
        p.maxGenesMutacionMasiva = base.maxGenesMutacionMasiva;
        p.maxHilosMasivo = base.maxHilosMasivo;
        p.usarReparacion = base.usarReparacion;
        p.intervaloReparacion = base.intervaloReparacion;
        p.maxEnviosARreparar = base.maxEnviosARreparar;
        p.intentosReparacionPorEnvio = base.intentosReparacionPorEnvio;
        return p;
    }

    public static class ResultadoVentana {
        public final List<Envio> enviosVentana;
        public final int diaMin;
        public final int diaMax;
        public final long totalMaletas;
        public final boolean factible;

        public ResultadoVentana(List<Envio> enviosVentana, int diaMin, int diaMax, long totalMaletas, boolean factible) {
            this.enviosVentana = enviosVentana;
            this.diaMin = diaMin;
            this.diaMax = diaMax;
            this.totalMaletas = totalMaletas;
            this.factible = factible;
        }
    }
}
