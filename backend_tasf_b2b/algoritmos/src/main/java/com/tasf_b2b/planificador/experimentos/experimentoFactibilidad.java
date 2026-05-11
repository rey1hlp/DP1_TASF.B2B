package com.tasf_b2b.planificador.experimentos;

import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;
import com.tasf_b2b.planificador.nucleo.GrafoVuelos;
import com.tasf_b2b.planificador.nucleo.Ruta;
import com.tasf_b2b.planificador.utils.UtilArchivos;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.PriorityQueue;

public class experimentoFactibilidad {
    private static final int MAX_ESCALAS = 12;
    private static final int MIN_ESCALA_MIN = 10;
    private static final int MIN_RECOJO_MIN = 10;

    public static void main(String[] args) {
        String raiz = System.getProperty("user.dir");
        Map<String, String> opts = parseArgs(args);
        String archivoEnvios = opts.getOrDefault("envios", "_envios_EBCI_5000.txt");
        String fechaInicio = opts.get("inicio");
        String fechaFin = opts.get("fin");
        String diasExtraStr = opts.get("dias-extra");
        int maxEnvios = parseEnteroSeguro(opts.getOrDefault("max-envios", "0"), 0);

        System.out.println("=== ANALISIS DE FACTIBILIDAD ===");

        Path rutaAeropuertosTxt = resolverRuta(raiz, "aeropuertos.txt");
        Path rutaAeropuertosCsv = resolverRuta(raiz, "aeropuertos.csv");
        Path rutaVuelos = resolverRuta(raiz, "planes_vuelo.txt");
        Path rutaEnvios = resolverRuta(raiz, archivoEnvios);

        try {
            UtilArchivos util = new UtilArchivos();
            Map<String, Aeropuerto> aeropuertos = util.cargarAeropuertos(rutaAeropuertosTxt, rutaAeropuertosCsv);
            List<Envio> envios = util.cargarEnvios(rutaEnvios, aeropuertos.keySet(), aeropuertos, fechaInicio, fechaFin);

            if (maxEnvios > 0 && envios.size() > maxEnvios) {
                envios = new ArrayList<>(envios.subList(0, maxEnvios));
            }

            int diaMin = envios.stream().mapToInt(e -> e.diaIndex).min().orElse(0);
            int diaMax = envios.stream().mapToInt(e -> e.diaIndex).max().orElse(diaMin);
            int maxSlaHoras = envios.stream().mapToInt(e -> e.slaHoras).max().orElse(0);
            int diasExtra = (diasExtraStr != null && !diasExtraStr.isBlank())
                ? parseEnteroSeguro(diasExtraStr, 0)
                : (int) Math.ceil(maxSlaHoras / 24.0);

            List<Vuelo> planes = util.cargarVuelos(rutaVuelos, aeropuertos.keySet());
            List<Vuelo> vuelos = util.instanciarVuelosPorRango(planes, diaMin, diaMax + Math.max(0, diasExtra));
            GrafoVuelos grafo = new GrafoVuelos(vuelos, aeropuertos);

            System.out.printf("Envios: %d | Vuelos instanciados: %d | Ventana: %s -> %s%n",
                envios.size(), vuelos.size(), UtilArchivos.formatearFecha(diaMin), UtilArchivos.formatearFecha(diaMax));

            imprimirCargaPorDia(envios);

            ResultadoFactibilidad resultado = analizar(grafo, envios, vuelos);
            imprimirResultado(resultado, envios.size());
        } catch (Exception e) {
            System.err.println("Error en analisis de factibilidad: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static ResultadoFactibilidad analizar(GrafoVuelos grafo, List<Envio> envios, List<Vuelo> vuelos) {
        ResultadoFactibilidad r = new ResultadoFactibilidad();
        int[] capacidadResidual = new int[vuelos.size()];
        for (Vuelo vuelo : vuelos) {
            capacidadResidual[vuelo.id] = vuelo.capacidad;
        }

        List<Envio> prioridad = new ArrayList<>(envios);
        prioridad.sort(Comparator
            .comparingInt((Envio e) -> e.slaHoras)
            .thenComparingInt(e -> e.horaIngresoMin)
            .thenComparing(Comparator.comparingInt((Envio e) -> e.cantidad).reversed()));

        for (Envio envio : envios) {
            Ruta rutaLibre = buscarRutaMasTemprana(grafo, envio, null);
            if (rutaLibre != null && rutaLibre.cumpleSLA) {
                r.factiblesSinCapacidad++;
            } else {
                r.sinRutaSlaEstructural++;
            }
        }

        for (Envio envio : prioridad) {
            Ruta rutaConCapacidad = buscarRutaMasTemprana(grafo, envio, capacidadResidual);
            if (rutaConCapacidad != null && rutaConCapacidad.cumpleSLA) {
                r.factiblesGreedyConCapacidad++;
                for (Vuelo vuelo : rutaConCapacidad.vuelos) {
                    capacidadResidual[vuelo.id] -= envio.cantidad;
                }
            } else {
                Ruta rutaLibre = buscarRutaMasTemprana(grafo, envio, null);
                if (rutaLibre != null && rutaLibre.cumpleSLA) {
                    r.bloqueadosPorCapacidad++;
                } else {
                    r.sinRutaSlaGreedy++;
                }
            }
        }

        return r;
    }

    private static Ruta buscarRutaMasTemprana(GrafoVuelos grafo, Envio envio, int[] capacidadResidual) {
        Map<String, Integer> aeropuertoIndex = new HashMap<>();
        int next = 0;
        for (String codigo : grafo.obtenerAeropuertos().keySet()) {
            aeropuertoIndex.put(codigo, next++);
        }

        int[][] mejorTiempo = new int[aeropuertoIndex.size()][MAX_ESCALAS + 1];
        for (int[] fila : mejorTiempo) {
            Arrays.fill(fila, Integer.MAX_VALUE);
        }

        PriorityQueue<Label> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a.tiempo));
        Integer idxOrigen = aeropuertoIndex.get(envio.origen);
        if (idxOrigen == null) {
            return null;
        }
        mejorTiempo[idxOrigen][0] = envio.horaIngresoMin;
        pq.add(new Label(envio.origen, envio.horaIngresoMin, 0, null, null));

        while (!pq.isEmpty()) {
            Label actual = pq.poll();
            Integer idxActual = aeropuertoIndex.get(actual.aeropuerto);
            if (idxActual == null || actual.tiempo != mejorTiempo[idxActual][actual.saltos]) {
                continue;
            }

            if (actual.aeropuerto.equals(envio.destino)) {
                List<Vuelo> vuelos = reconstruir(actual);
                Ruta ruta = new Ruta(vuelos, envio.horaIngresoMin, envio.slaHoras, MIN_RECOJO_MIN);
                if (ruta.cumpleSLA) {
                    return ruta;
                }
                continue;
            }

            if (actual.saltos >= MAX_ESCALAS) {
                continue;
            }

            int tiempoMinimoSalida = actual.tiempo + MIN_ESCALA_MIN;
            for (Vuelo vuelo : grafo.obtenerVuelosDesde(actual.aeropuerto, tiempoMinimoSalida)) {
                if (vuelo.salidaMin < tiempoMinimoSalida) {
                    continue;
                }
                if (capacidadResidual != null && capacidadResidual[vuelo.id] < envio.cantidad) {
                    continue;
                }

                int tiempoFinalMin = vuelo.llegadaMin + MIN_RECOJO_MIN;
                double horasTotales = Math.max(0, tiempoFinalMin - envio.horaIngresoMin) / 60.0;
                if (horasTotales > envio.slaHoras) {
                    continue;
                }

                Integer idxDestino = aeropuertoIndex.get(vuelo.destino);
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

    private static void imprimirCargaPorDia(List<Envio> envios) {
        Map<Integer, Integer> porDia = new HashMap<>();
        for (Envio envio : envios) {
            porDia.merge(envio.diaIndex, 1, Integer::sum);
        }

        int maxDia = -1;
        int maxEnvios = 0;
        for (Map.Entry<Integer, Integer> entry : porDia.entrySet()) {
            if (entry.getValue() > maxEnvios) {
                maxEnvios = entry.getValue();
                maxDia = entry.getKey();
            }
        }

        System.out.printf("Pico diario en la ventana: %d envios (%s)%n",
            maxEnvios,
            maxDia >= 0 ? UtilArchivos.formatearFecha(maxDia) : "N/A");
    }

    private static void imprimirResultado(ResultadoFactibilidad r, int total) {
        double pctEstructural = total == 0 ? 0.0 : (r.factiblesSinCapacidad * 100.0) / total;
        double pctGreedy = total == 0 ? 0.0 : (r.factiblesGreedyConCapacidad * 100.0) / total;

        System.out.println();
        System.out.println("Techo estructural ignorando capacidad:");
        System.out.printf(Locale.US, "  %d/%d = %.2f%%%n", r.factiblesSinCapacidad, total, pctEstructural);
        System.out.println("  No SLA-factibles ni aunque no compitan: " + r.sinRutaSlaEstructural);

        System.out.println();
        System.out.println("Piso operativo greedy con capacidad:");
        System.out.printf(Locale.US, "  %d/%d = %.2f%%%n", r.factiblesGreedyConCapacidad, total, pctGreedy);
        System.out.println("  Bloqueados por capacidad aunque si existe ruta SLA: " + r.bloqueadosPorCapacidad);
        System.out.println("  Sin ruta SLA incluso en greedy: " + r.sinRutaSlaGreedy);
    }

    private static Path resolverRuta(String raiz, String archivo) {
        Path directaArg = Paths.get(archivo);
        if (directaArg.isAbsolute() && Files.exists(directaArg)) return directaArg;
        Path relativa = Paths.get(raiz, archivo);
        if (Files.exists(relativa)) return relativa;
        Path directa = Paths.get(raiz, "data", archivo);
        if (Files.exists(directa)) return directa;
        Path conModulo = Paths.get(raiz, "genetico", "data", archivo);
        if (Files.exists(conModulo)) return conModulo;
        return directa;
    }

    private static Map<String, String> parseArgs(String[] args) {
        Map<String, String> map = new HashMap<>();
        if (args == null) return map;

        for (String arg : args) {
            if (arg == null || arg.isBlank()) continue;
            String limpio = arg.trim();
            if (limpio.startsWith("--")) limpio = limpio.substring(2);
            int eq = limpio.indexOf('=');
            if (eq > 0) {
                map.put(limpio.substring(0, eq).trim().toLowerCase(Locale.ROOT), limpio.substring(eq + 1).trim());
            }
        }
        return map;
    }

    private static int parseEnteroSeguro(String valor, int def) {
        try {
            return Integer.parseInt(valor.trim());
        } catch (Exception e) {
            return def;
        }
    }

    private static class ResultadoFactibilidad {
        int factiblesSinCapacidad;
        int sinRutaSlaEstructural;
        int factiblesGreedyConCapacidad;
        int bloqueadosPorCapacidad;
        int sinRutaSlaGreedy;
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
}
