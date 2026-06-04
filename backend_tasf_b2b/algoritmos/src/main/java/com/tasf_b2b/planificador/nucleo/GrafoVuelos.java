package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

public class GrafoVuelos {

    private final Map<String, List<Vuelo>> adyacencia;
    private final Map<String, Aeropuerto> aeropuertos;
    private final List<Vuelo> vuelos;
    private final Random rnd = new Random();

    public GrafoVuelos(List<Vuelo> vuelos, Map<String, Aeropuerto> aeropuertos) {
        this.vuelos = vuelos;
        this.aeropuertos = aeropuertos;
        this.adyacencia = new HashMap<>();
        for (Vuelo vuelo : vuelos) {
            adyacencia.computeIfAbsent(vuelo.origen, k -> new ArrayList<>()).add(vuelo);
        }
        for (List<Vuelo> lista : adyacencia.values()) {
            lista.sort(Comparator.comparingInt(a -> a.salidaMin));
        }
    }

    public Map<String, Aeropuerto> obtenerAeropuertos() {
        return Collections.unmodifiableMap(aeropuertos);
    }

    public List<Vuelo> obtenerVuelos() {
        return vuelos;
    }

    public List<Vuelo> obtenerVuelosDesde(String codigoOaci) {
        return adyacencia.getOrDefault(codigoOaci, Collections.emptyList());
    }

    public List<Vuelo> obtenerVuelosDesde(String codigoOaci, int tiempoMinimoSalida) {
        List<Vuelo> lista = adyacencia.getOrDefault(codigoOaci, Collections.emptyList());
        if (lista.isEmpty()) return lista;
        int idx = buscarPrimerIndice(lista, tiempoMinimoSalida);
        if (idx <= 0) return lista;
        if (idx >= lista.size()) return Collections.emptyList();
        return lista.subList(idx, lista.size());
    }

    public List<Vuelo> buscarRutaAleatoria(String origen, String destino, int horaSalidaMin, int maxEscalas) {
        return buscarRutaAleatoria(origen, destino, horaSalidaMin, maxEscalas, 10);
    }

    public List<Vuelo> buscarRutaAleatoria(String origen, String destino, int horaSalidaMin, int maxEscalas, int minEscalaMin) {
        for (int intento = 0; intento < 100; intento++) {
            List<Vuelo> ruta = new ArrayList<>();
            String actual = origen;
            int tiempoActual = horaSalidaMin;
            boolean llego = false;

            for (int i = 0; i < maxEscalas; i++) {
                int esperaMinima = ruta.isEmpty() ? 0 : minEscalaMin;
                int tiempoMinimoSalida = tiempoActual + esperaMinima;
                final String aeropuertoActual = actual;

                List<Vuelo> validos = obtenerVuelosDesde(actual, tiempoMinimoSalida).stream()
                    .filter(v -> v.salidaMin >= tiempoMinimoSalida)
                    .filter(v -> esAcercamiento(aeropuertoActual, v.destino, destino))
                    .toList();

                if (validos.isEmpty()) {
                    validos = obtenerVuelosDesde(actual, tiempoMinimoSalida).stream()
                        .filter(v -> v.salidaMin >= tiempoMinimoSalida)
                        .toList();
                }

                if (validos.isEmpty()) {
                    break;
                }

                List<Vuelo> directos = validos.stream()
                    .filter(v -> v.destino.equals(destino))
                    .toList();

                Vuelo elegido;
                if (!directos.isEmpty()) {
                    elegido = directos.get(rnd.nextInt(directos.size()));
                    llego = true;
                } else {
                    elegido = validos.get(rnd.nextInt(validos.size()));
                }

                ruta.add(elegido);
                actual = elegido.destino;
                tiempoActual = elegido.llegadaMin;

                if (llego) {
                    return ruta;
                }
            }
        }
        return null;
    }

    public List<Vuelo> buscarMejorRutaPorReintentos(
        String origen,
        String destino,
        int horaSalidaMin,
        int slaHoras,
        int minEscalaMin,
        int maxEscalas,
        int minRecojoMin,
        int reintentos
    ) {
        List<Vuelo> mejorRuta = null;
        double mejorExcesoSla = Double.POSITIVE_INFINITY;
        double mejorTiempo = Double.POSITIVE_INFINITY;
        int mejoresSaltos = Integer.MAX_VALUE;

        for (int i = 0; i < Math.max(1, reintentos); i++) {
            List<Vuelo> candidata = buscarRutaAleatoria(origen, destino, horaSalidaMin, maxEscalas, minEscalaMin);
            if (candidata == null || candidata.isEmpty()) {
                continue;
            }

            Ruta ruta = new Ruta(candidata, horaSalidaMin, slaHoras, minRecojoMin);
            double excesoSla = Math.max(0.0, ruta.tiempoTotalHoras - slaHoras);
            int saltos = candidata.size();

            boolean mejora = false;
            if (excesoSla < mejorExcesoSla) {
                mejora = true;
            } else if (Double.compare(excesoSla, mejorExcesoSla) == 0 && ruta.tiempoTotalHoras < mejorTiempo) {
                mejora = true;
            } else if (Double.compare(excesoSla, mejorExcesoSla) == 0
                && Double.compare(ruta.tiempoTotalHoras, mejorTiempo) == 0
                && saltos < mejoresSaltos) {
                mejora = true;
            }

            if (mejora) {
                mejorRuta = candidata;
                mejorExcesoSla = excesoSla;
                mejorTiempo = ruta.tiempoTotalHoras;
                mejoresSaltos = saltos;
                if (excesoSla == 0.0 && saltos <= 2) {
                    break;
                }
            }
        }

        return mejorRuta;
    }

    private int buscarPrimerIndice(List<Vuelo> vuelos, int tiempoMinimoSalida) {
        int lo = 0;
        int hi = vuelos.size();
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (vuelos.get(mid).salidaMin < tiempoMinimoSalida) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    private boolean esAcercamiento(String actual, String candidato, String destino) {
        if (!aeropuertos.containsKey(candidato)) return true;

        Aeropuerto aActual = aeropuertos.get(actual);
        Aeropuerto aCandidato = aeropuertos.get(candidato);
        Aeropuerto aDestino = aeropuertos.get(destino);

        double distActual = aActual.distanciaKm(aDestino);
        double distCandidato = aCandidato.distanciaKm(aDestino);

        return distCandidato < distActual * 1.5;
    }
}
