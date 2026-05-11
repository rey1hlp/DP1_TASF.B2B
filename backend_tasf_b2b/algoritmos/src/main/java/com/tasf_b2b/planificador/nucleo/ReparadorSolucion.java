package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class ReparadorSolucion {
    private ReparadorSolucion() {
    }

    public static boolean reparar(
        Individuo ind,
        GrafoVuelos grafo,
        List<Envio> envios,
        Map<String, Integer> capacidadPorAeropuerto,
        int[] cargaVuelo,
        int[] marcaVuelo,
        double pesoTiempo,
        double pesoEscalas,
        double penalidadSinRuta,
        double penalidadSla,
        double penalidadHoraRetraso,
        double penalidadCapVuelo,
        double penalidadCapAlmacen,
        int minEscalaMin,
        int minRecojoMin,
        int maxEnviosARreparar,
        int intentosPorEnvio
    ) {
        double fitnessActual = evaluar(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaVuelo,
            marcaVuelo,
            pesoTiempo,
            pesoEscalas,
            penalidadSinRuta,
            penalidadSla,
            penalidadHoraRetraso,
            penalidadCapVuelo,
            penalidadCapAlmacen,
            minEscalaMin,
            minRecojoMin
        );
        ind.fitness = fitnessActual;
        ind.fitnessValido = true;

        List<Integer> candidatos = priorizarEnviosProblematicos(ind, envios, maxEnviosARreparar);
        boolean huboMejora = false;

        for (int idx : candidatos) {
            Envio envio = envios.get(idx);
            Ruta original = ind.asignaciones[idx];

            List<Vuelo> mejorRuta = null;
            double mejorFitness = fitnessActual;

            for (int extraEscalas = 0; extraEscalas < 3; extraEscalas++) {
                int maxEscalas = Math.max(3, Math.min(10, 4 + extraEscalas * 2));
                List<Vuelo> propuesta = grafo.buscarMejorRutaPorReintentos(
                    envio.origen,
                    envio.destino,
                    envio.horaIngresoMin,
                    envio.slaHoras,
                    minEscalaMin,
                    maxEscalas,
                    minRecojoMin,
                    intentosPorEnvio
                );
                if (propuesta == null || propuesta.isEmpty()) {
                    continue;
                }

                ind.asignaciones[idx] = new Ruta(propuesta, envio.horaIngresoMin, envio.slaHoras, minRecojoMin);
                double fitnessCandidato = evaluar(
                    ind,
                    envios,
                    capacidadPorAeropuerto,
                    cargaVuelo,
                    marcaVuelo,
                    pesoTiempo,
                    pesoEscalas,
                    penalidadSinRuta,
                    penalidadSla,
                    penalidadHoraRetraso,
                    penalidadCapVuelo,
                    penalidadCapAlmacen,
                    minEscalaMin,
                    minRecojoMin
                );

                if (fitnessCandidato + 1e-6 < mejorFitness) {
                    mejorFitness = fitnessCandidato;
                    mejorRuta = propuesta;
                }
            }

            if (mejorRuta != null) {
                ind.asignaciones[idx] = new Ruta(mejorRuta, envio.horaIngresoMin, envio.slaHoras, minRecojoMin);
                fitnessActual = mejorFitness;
                ind.fitness = fitnessActual;
                ind.fitnessValido = true;
                huboMejora = true;
            } else {
                ind.asignaciones[idx] = original;
            }
        }

        return huboMejora;
    }

    private static double evaluar(
        Individuo ind,
        List<Envio> envios,
        Map<String, Integer> capacidadPorAeropuerto,
        int[] cargaVuelo,
        int[] marcaVuelo,
        double pesoTiempo,
        double pesoEscalas,
        double penalidadSinRuta,
        double penalidadSla,
        double penalidadHoraRetraso,
        double penalidadCapVuelo,
        double penalidadCapAlmacen,
        int minEscalaMin,
        int minRecojoMin
    ) {
        Arrays.fill(cargaVuelo, 0);
        Arrays.fill(marcaVuelo, 0);
        return EvaluadorFitness.evaluar(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaVuelo,
            marcaVuelo,
            1,
            pesoTiempo,
            pesoEscalas,
            penalidadSinRuta,
            penalidadSla,
            penalidadHoraRetraso,
            penalidadCapVuelo,
            penalidadCapAlmacen,
            minEscalaMin,
            minRecojoMin
        );
    }

    private static List<Integer> priorizarEnviosProblematicos(Individuo ind, List<Envio> envios, int maxEnvios) {
        List<Integer> indices = new ArrayList<>(envios.size());
        for (int i = 0; i < envios.size(); i++) {
            indices.add(i);
        }

        indices.sort(Comparator.comparingDouble((Integer idx) -> severidad(ind.asignaciones[idx], envios.get(idx))).reversed());

        if (indices.size() > maxEnvios) {
            return new ArrayList<>(indices.subList(0, maxEnvios));
        }
        return indices;
    }

    private static double severidad(Ruta ruta, Envio envio) {
        if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) {
            return 1_000_000.0;
        }
        double retraso = Math.max(0.0, ruta.tiempoTotalHoras - envio.slaHoras);
        if (retraso > 0.0) {
            return 100_000.0 + retraso;
        }
        return ruta.vuelos.size() * 0.1 + ruta.tiempoTotalHoras * 0.01;
    }
}
