package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public final class ConstructorSolucionVoraz {
    private static final int UMBRAL_INSTANCIA_GRANDE = 50_000;
    private static final int TAM_BUCKET_MIN = 30;

    private ConstructorSolucionVoraz() {
    }

    public static Individuo construir(
        GrafoVuelos grafo,
        List<Envio> envios,
        List<Vuelo> vuelos,
        int maxEscalas,
        int minEscalaMin,
        int minRecojoMin
    ) {
        if (envios.size() >= UMBRAL_INSTANCIA_GRANDE) {
            return construirRapido(grafo, envios, vuelos, maxEscalas, minEscalaMin, minRecojoMin);
        }
        return construirExacto(grafo, envios, vuelos, maxEscalas, minEscalaMin, minRecojoMin);
    }

    private static Individuo construirExacto(
        GrafoVuelos grafo,
        List<Envio> envios,
        List<Vuelo> vuelos,
        int maxEscalas,
        int minEscalaMin,
        int minRecojoMin
    ) {
        Individuo ind = new Individuo(envios.size());
        Contexto contexto = new Contexto(grafo, vuelos, maxEscalas);
        Map<Integer, Integer> indiceVuelo = construirIndiceVuelos(vuelos);
        int[] capacidadResidual = new int[vuelos.size()];
        for (int i = 0; i < vuelos.size(); i++) {
            Vuelo vuelo = vuelos.get(i);
            capacidadResidual[i] = vuelo.capacidad;
        }

        List<Integer> orden = new ArrayList<>(envios.size());
        for (int i = 0; i < envios.size(); i++) {
            orden.add(i);
        }
        orden.sort(Comparator
            .comparingInt((Integer idx) -> envios.get(idx).slaHoras)
            .thenComparingInt(idx -> envios.get(idx).horaIngresoMin)
            .thenComparing(Comparator.comparingInt((Integer idx) -> envios.get(idx).cantidad).reversed()));

        for (int idx : orden) {
            Envio envio = envios.get(idx);
            Ruta ruta = buscarRutaMasTemprana(
                grafo,
                envio,
                capacidadResidual,
                maxEscalas,
                minEscalaMin,
                minRecojoMin,
                contexto,
                indiceVuelo
            );
            if (ruta != null && ruta.cumpleSLA) {
                ind.asignaciones[idx] = ruta;
                for (Vuelo vuelo : ruta.vuelos) {
                    Integer idxVuelo = indiceVuelo.get(vuelo.id);
                    if (idxVuelo == null || idxVuelo < 0 || idxVuelo >= capacidadResidual.length) {
                        continue;
                    }
                    capacidadResidual[idxVuelo] -= envio.cantidad;
                }
            } else {
                ind.asignaciones[idx] = new Ruta(null, envio.horaIngresoMin, envio.slaHoras, minRecojoMin);
            }
        }

        return ind;
    }

    private static Individuo construirRapido(
        GrafoVuelos grafo,
        List<Envio> envios,
        List<Vuelo> vuelos,
        int maxEscalas,
        int minEscalaMin,
        int minRecojoMin
    ) {
        Individuo ind = new Individuo(envios.size());
        Contexto contexto = new Contexto(grafo, vuelos, maxEscalas);
        Map<ClaveRuta, PlantillaRuta> cache = new HashMap<>(4096);

        for (int i = 0; i < envios.size(); i++) {
            Envio envio = envios.get(i);
            ClaveRuta clave = new ClaveRuta(envio.origen, envio.destino, envio.horaIngresoLocal / TAM_BUCKET_MIN, envio.slaHoras);

            Ruta ruta = null;
            PlantillaRuta plantilla = cache.get(clave);
            if (plantilla != null) {
                ruta = instanciarPlantilla(plantilla, envio, minRecojoMin, contexto);
            }

            if (ruta == null || !ruta.cumpleSLA) {
                ruta = buscarRutaMasTemprana(
                    grafo,
                    envio,
                    null,
                    maxEscalas,
                    minEscalaMin,
                    minRecojoMin,
                    contexto,
                    null
                );
                if (ruta != null && ruta.cumpleSLA) {
                    cache.put(clave, PlantillaRuta.desde(ruta, envio));
                }
            }

            ind.asignaciones[i] = (ruta != null && ruta.cumpleSLA)
                ? ruta
                : new Ruta(null, envio.horaIngresoMin, envio.slaHoras, minRecojoMin);
        }

        return ind;
    }

    public static Ruta buscarRutaMasTemprana(
        GrafoVuelos grafo,
        Envio envio,
        int[] capacidadResidual,
        int maxEscalas,
        int minEscalaMin,
        int minRecojoMin
    ) {
        return buscarRutaMasTemprana(
            grafo,
            envio,
            capacidadResidual,
            maxEscalas,
            minEscalaMin,
            minRecojoMin,
            new Contexto(grafo, grafo.obtenerVuelos(), maxEscalas),
            construirIndiceVuelos(grafo.obtenerVuelos())
        );
    }

    private static Ruta buscarRutaMasTemprana(
        GrafoVuelos grafo,
        Envio envio,
        int[] capacidadResidual,
        int maxEscalas,
        int minEscalaMin,
        int minRecojoMin,
        Contexto contexto,
        Map<Integer, Integer> indiceVuelo
    ) {
        int[][] mejorTiempo = contexto.takeMejorTiempo();
        for (int i = 0; i < mejorTiempo.length; i++) {
            Arrays.fill(mejorTiempo[i], Integer.MAX_VALUE);
        }

        PriorityQueue<Label> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a.tiempo));
        Integer idxOrigen = contexto.aeropuertoIndex.get(envio.origen);
        if (idxOrigen == null) {
            return null;
        }

        mejorTiempo[idxOrigen][0] = envio.horaIngresoMin;
        pq.add(new Label(envio.origen, envio.horaIngresoMin, 0, null, null));

        while (!pq.isEmpty()) {
            Label actual = pq.poll();
            Integer idxActual = contexto.aeropuertoIndex.get(actual.aeropuerto);
            if (idxActual == null || actual.tiempo != mejorTiempo[idxActual][actual.saltos]) {
                continue;
            }

            if (actual.aeropuerto.equals(envio.destino)) {
                List<Vuelo> rutaVuelos = reconstruir(actual);
                Ruta ruta = new Ruta(rutaVuelos, envio.horaIngresoMin, envio.slaHoras, minRecojoMin);
                if (ruta.cumpleSLA) {
                    return ruta;
                }
                continue;
            }

            if (actual.saltos >= maxEscalas) {
                continue;
            }

            int esperaMinima = actual.vueloPrevio == null ? 0 : minEscalaMin;
            int tiempoMinimoSalida = actual.tiempo + esperaMinima;
            for (Vuelo vuelo : grafo.obtenerVuelosDesde(actual.aeropuerto, tiempoMinimoSalida)) {
                if (vuelo.salidaMin < tiempoMinimoSalida) {
                    continue;
                }
                if (capacidadResidual != null && indiceVuelo != null) {
                    Integer idxVuelo = indiceVuelo.get(vuelo.id);
                    if (idxVuelo == null || idxVuelo < 0 || idxVuelo >= capacidadResidual.length) {
                        continue;
                    }
                    if (capacidadResidual[idxVuelo] < envio.cantidad) {
                        continue;
                    }
                }
                if (capacidadResidual != null && indiceVuelo == null) {
                    continue;
                }
                if (capacidadResidual == null) {
                    // sin control de capacidad
                }

                int tiempoFinalMin = vuelo.llegadaMin + minRecojoMin;
                double horasTotales = Math.max(0, tiempoFinalMin - envio.horaIngresoMin) / 60.0;
                if (horasTotales > envio.slaHoras) {
                    continue;
                }

                Integer idxDestino = contexto.aeropuertoIndex.get(vuelo.destino);
                if (idxDestino == null) {
                    continue;
                }

                int nuevoSalto = actual.saltos + 1;
                if (vuelo.llegadaMin < mejorTiempo[idxDestino][nuevoSalto]) {
                    mejorTiempo[idxDestino][nuevoSalto] = vuelo.llegadaMin;
                    pq.add(new Label(vuelo.destino, vuelo.llegadaMin, nuevoSalto, actual, vuelo));
                }
            }
        }

        return null;
    }

    private static Ruta instanciarPlantilla(PlantillaRuta plantilla, Envio envio, int minRecojoMin, Contexto contexto) {
        List<Vuelo> vuelos = new ArrayList<>(plantilla.tramos.size());
        for (TramoPlantilla tramo : plantilla.tramos) {
            Vuelo vuelo = contexto.buscarVueloPorPlanYDia(tramo.planId, envio.diaIndex + tramo.offsetDia);
            if (vuelo == null) {
                return null;
            }
            vuelos.add(vuelo);
        }
        Ruta ruta = new Ruta(vuelos, envio.horaIngresoMin, envio.slaHoras, minRecojoMin);
        return ruta.cumpleSLA ? ruta : null;
    }

    private static List<Vuelo> reconstruir(Label label) {
        ArrayDeque<Vuelo> pila = new ArrayDeque<>();
        Label cursor = label;
        while (cursor != null && cursor.vueloPrevio != null) {
            pila.push(cursor.vueloPrevio);
            cursor = cursor.prev;
        }

        List<Vuelo> ruta = new ArrayList<>(pila.size());
        while (!pila.isEmpty()) {
            ruta.add(pila.pop());
        }
        return ruta;
    }

    private static Map<String, Integer> construirIndiceAeropuertos(GrafoVuelos grafo) {
        Map<String, Integer> aeropuertoIndex = new HashMap<>();
        int next = 0;
        for (String codigo : grafo.obtenerAeropuertos().keySet()) {
            aeropuertoIndex.put(codigo, next++);
        }
        return aeropuertoIndex;
    }

    private static Map<Integer, Integer> construirIndiceVuelos(List<Vuelo> vuelos) {
        Map<Integer, Integer> indice = new HashMap<>();
        for (int i = 0; i < vuelos.size(); i++) {
            indice.put(vuelos.get(i).id, i);
        }
        return indice;
    }

    private static class Contexto {
        final Map<String, Integer> aeropuertoIndex;
        final Map<Integer, List<Vuelo>> vuelosPorPlanId;
        final int maxEscalas;
        final ThreadLocal<int[][]> mejorTiempo;

        Contexto(GrafoVuelos grafo, List<Vuelo> vuelos, int maxEscalas) {
            this.aeropuertoIndex = construirIndiceAeropuertos(grafo);
            this.vuelosPorPlanId = new HashMap<>();
            for (Vuelo vuelo : vuelos) {
                vuelosPorPlanId.computeIfAbsent(vuelo.idPlan, k -> new ArrayList<>()).add(vuelo);
            }
            for (List<Vuelo> lista : vuelosPorPlanId.values()) {
                lista.sort(Comparator.comparingInt(v -> v.diaIndex));
            }
            this.maxEscalas = maxEscalas;
            this.mejorTiempo = ThreadLocal.withInitial(() -> new int[aeropuertoIndex.size()][this.maxEscalas + 1]);
        }

        int[][] takeMejorTiempo() {
            return mejorTiempo.get();
        }

        Vuelo buscarVueloPorPlanYDia(int planId, int diaIndex) {
            List<Vuelo> lista = vuelosPorPlanId.get(planId);
            if (lista == null || lista.isEmpty()) {
                return null;
            }
            int lo = 0;
            int hi = lista.size() - 1;
            while (lo <= hi) {
                int mid = (lo + hi) >>> 1;
                Vuelo vuelo = lista.get(mid);
                if (vuelo.diaIndex == diaIndex) {
                    return vuelo;
                }
                if (vuelo.diaIndex < diaIndex) {
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            return null;
        }
    }

    private static class Label {
        final String aeropuerto;
        final int tiempo;
        final int saltos;
        final Label prev;
        final Vuelo vueloPrevio;

        Label(String aeropuerto, int tiempo, int saltos, Label prev, Vuelo vueloPrevio) {
            this.aeropuerto = aeropuerto;
            this.tiempo = tiempo;
            this.saltos = saltos;
            this.prev = prev;
            this.vueloPrevio = vueloPrevio;
        }
    }

    private static class ClaveRuta {
        final String origen;
        final String destino;
        final int bucketHora;
        final int slaHoras;

        ClaveRuta(String origen, String destino, int bucketHora, int slaHoras) {
            this.origen = origen;
            this.destino = destino;
            this.bucketHora = bucketHora;
            this.slaHoras = slaHoras;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof ClaveRuta other)) return false;
            return bucketHora == other.bucketHora
                && slaHoras == other.slaHoras
                && origen.equals(other.origen)
                && destino.equals(other.destino);
        }

        @Override
        public int hashCode() {
            int result = origen.hashCode();
            result = 31 * result + destino.hashCode();
            result = 31 * result + bucketHora;
            result = 31 * result + slaHoras;
            return result;
        }
    }

    private static class PlantillaRuta {
        final List<TramoPlantilla> tramos;

        PlantillaRuta(List<TramoPlantilla> tramos) {
            this.tramos = tramos;
        }

        static PlantillaRuta desde(Ruta ruta, Envio envio) {
            List<TramoPlantilla> tramos = new ArrayList<>(ruta.vuelos.size());
            for (Vuelo vuelo : ruta.vuelos) {
                tramos.add(new TramoPlantilla(vuelo.idPlan, vuelo.diaIndex - envio.diaIndex));
            }
            return new PlantillaRuta(tramos);
        }
    }

    private static class TramoPlantilla {
        final int planId;
        final int offsetDia;

        TramoPlantilla(int planId, int offsetDia) {
            this.planId = planId;
            this.offsetDia = offsetDia;
        }
    }
}
