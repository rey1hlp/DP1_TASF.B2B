package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class EvaluadorFitness {
    private EvaluadorFitness() {
    }

    public static double evaluar(
        Individuo ind,
        List<Envio> envios,
        Map<String, Integer> capacidadPorAeropuerto,
        int[] cargaVuelo,
        int[] marcaVuelo,
        int marcaLocal,
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
        double fitnessTotal = 0.0;
        int sinRuta = 0;
        int violSla = 0;
        int violCapVuelo = 0;

        for (int i = 0; i < envios.size(); i++) {
            Envio envio = envios.get(i);
            Ruta ruta = ind.asignaciones[i];

            if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) {
                sinRuta++;
                fitnessTotal += penalidadSinRuta;
                continue;
            }

            fitnessTotal += ruta.tiempoTotalHoras * pesoTiempo;
            fitnessTotal += ruta.vuelos.size() * pesoEscalas;

            double retrasoHoras = Math.max(0.0, ruta.tiempoTotalHoras - envio.slaHoras);
            if (retrasoHoras > 0.0) {
                violSla++;
                fitnessTotal += penalidadSla;
                fitnessTotal += retrasoHoras * penalidadHoraRetraso;
            }

            for (Vuelo vuelo : ruta.vuelos) {
                int idVuelo = vuelo.id;
                if (idVuelo < 0 || idVuelo >= cargaVuelo.length) {
                    continue;
                }

                if (marcaVuelo[idVuelo] != marcaLocal) {
                    marcaVuelo[idVuelo] = marcaLocal;
                    cargaVuelo[idVuelo] = 0;
                }

                int nuevaCarga = cargaVuelo[idVuelo] + envio.cantidad;
                if (nuevaCarga > vuelo.capacidad) {
                    violCapVuelo++;
                    fitnessTotal += penalidadCapVuelo;
                }
                cargaVuelo[idVuelo] = nuevaCarga;
            }
        }

        int violCapAlmacen = contarViolacionesAlmacen(
            ind,
            envios,
            capacidadPorAeropuerto,
            minEscalaMin,
            minRecojoMin
        );
        fitnessTotal += violCapAlmacen * penalidadCapAlmacen;

        ind.sinRuta = sinRuta;
        ind.violSla = violSla;
        ind.violCapVuelo = violCapVuelo;
        ind.violCapAlmacen = violCapAlmacen;
        return fitnessTotal;
    }

    public static int contarViolacionesAlmacen(
        Individuo ind,
        List<Envio> envios,
        Map<String, Integer> capacidadPorAeropuerto,
        int minEscalaMin,
        int minRecojoMin
    ) {
        Map<String, List<int[]>> eventos = new HashMap<>();

        for (int i = 0; i < envios.size(); i++) {
            Envio envio = envios.get(i);
            Ruta ruta = ind.asignaciones[i];
            if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) {
                continue;
            }

            for (int j = 0; j < ruta.vuelos.size(); j++) {
                int llegada = ruta.llegadasAlmacenMin[j];
                int salida = ruta.salidasAlmacenMin[j];
                if (salida <= llegada) {
                    continue;
                }

                Vuelo vuelo = ruta.vuelos.get(j);
                List<int[]> evs = eventos.computeIfAbsent(vuelo.destino, k -> new ArrayList<>());
                evs.add(new int[] {llegada, envio.cantidad});
                evs.add(new int[] {salida, -envio.cantidad});
            }
        }

        int violaciones = 0;
        for (Map.Entry<String, List<int[]>> entry : eventos.entrySet()) {
            List<int[]> evs = entry.getValue();
            evs.sort(Comparator.comparingInt(a -> a[0]));

            int ocupacion = 0;
            int capacidad = capacidadPorAeropuerto.getOrDefault(entry.getKey(), 500);
            for (int[] ev : evs) {
                ocupacion += ev[1];
                if (ocupacion > capacidad) {
                    violaciones++;
                }
            }
        }

        return violaciones;
    }

    public static boolean esFactible(
        Individuo ind,
        List<Envio> envios,
        Map<String, Integer> capacidadPorAeropuerto,
        int[] cargaVuelo,
        int[] marcaVuelo,
        int marcaLocal,
        int minEscalaMin,
        int minRecojoMin
    ) {
        evaluar(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaVuelo,
            marcaVuelo,
            marcaLocal,
            0.0,
            0.0,
            1.0,
            1.0,
            0.0,
            1.0,
            1.0,
            minEscalaMin,
            minRecojoMin
        );
        return ind.esFactible();
    }
}
