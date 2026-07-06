package com.tasf_b2b.planificador.utils;

import com.tasf_b2b.planificador.dominio.*;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class UtilArchivos extends BaseParser {

    private static final DateTimeFormatter FECHA_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final Pattern PATRON_ORIGEN = Pattern.compile("_envios_([A-Za-z0-9]{4})_");

    public Map<String, Aeropuerto> cargarAeropuertos(Path txt, Path csv) throws IOException {
        ParserAeropuertos parserAero = new ParserAeropuertos();
        parserAero.fromTXTtoCSV(txt, csv);
        return parserAero.fromCSVToRuntimeObjects(csv);
    }

    public List<Vuelo> cargarVuelos(Path p, Set<String> iatasValidas) throws IOException {
        List<Vuelo> vuelos = new ArrayList<>();
        int id = 0;
        try (BufferedReader br = abrirReader(p)) {
            String linea;
            while ((linea = br.readLine()) != null) {
                String t = linea.trim();
                if (t.isEmpty() || t.startsWith("#")) continue;

                String[] f = t.split("-");
                if (f.length < 5) continue;

                String o = f[0].trim();
                String d = f[1].trim();

                if (!f[2].contains(":") || !f[3].contains(":")) continue;

                if (iatasValidas != null && (!iatasValidas.contains(o) || !iatasValidas.contains(d))) continue;

                try {
                    String[] sal = f[2].split(":");
                    String[] lle = f[3].split(":");

                    int salidaMin = (Integer.parseInt(sal[0]) * 60) + Integer.parseInt(sal[1]);
                    int llegadaMin = (Integer.parseInt(lle[0]) * 60) + Integer.parseInt(lle[1]);
                    int cap = parsearEntero(f[4]);

                    vuelos.add(new Vuelo(id++, o, d, salidaMin, llegadaMin, cap));
                } catch (Exception e) {}
            }
        }
        return vuelos;
    }

    public List<Envio> cargarEnvios(Path p, Set<String> iatasValidas, Map<String, Aeropuerto> aeropuertos) throws IOException {
        return cargarEnvios(p, iatasValidas, aeropuertos, null, null);
    }

    public List<Envio> cargarEnvios(Path p, Set<String> iatasValidas, Map<String, Aeropuerto> aeropuertos,
                                   String fechaInicio, String fechaFin) throws IOException {
        List<Envio> envios;
        if (p != null && Files.isDirectory(p)) {
            envios = cargarEnviosDesdeDirectorio(p, iatasValidas, aeropuertos, fechaInicio, fechaFin);
        } else {
            envios = cargarEnviosArchivo(p, iatasValidas, aeropuertos, fechaInicio, fechaFin);
        }
        envios.sort(Comparator.comparingInt(e -> e.horaIngresoMin));
        return envios;
    }

    public List<Envio> cargarEnviosDesdeDirectorio(Path dir, Set<String> iatasValidas, Map<String, Aeropuerto> aeropuertos,
                                                   String fechaInicio, String fechaFin) throws IOException {
        List<Envio> envios = new ArrayList<>();
        if (dir == null || !Files.exists(dir) || !Files.isDirectory(dir)) return envios;

        try (java.util.stream.Stream<Path> stream = Files.list(dir)) {
            List<Path> archivos = stream
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".txt"))
                .filter(p -> p.getFileName().toString().toLowerCase(Locale.ROOT).contains("_envios_"))
                .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                .collect(Collectors.toList());

            for (Path archivo : archivos) {
                envios.addAll(cargarEnviosArchivo(archivo, iatasValidas, aeropuertos, fechaInicio, fechaFin));
            }
        }

        return envios;
    }

    private List<Envio> cargarEnviosArchivo(Path p, Set<String> iatasValidas, Map<String, Aeropuerto> aeropuertos,
                                            String fechaInicio, String fechaFin) throws IOException {
        List<Envio> envios = new ArrayList<>();
        if (p == null || !Files.exists(p)) return envios;

        Integer diaInicio = (fechaInicio != null && !fechaInicio.isBlank()) ? obtenerDiaIndex(fechaInicio) : null;
        Integer diaFin = (fechaFin != null && !fechaFin.isBlank()) ? obtenerDiaIndex(fechaFin) : null;

        String nombreArchivo = p.getFileName().toString();
        String origen = extraerOrigenArchivo(nombreArchivo);

        try (BufferedReader br = abrirReader(p)) {
            String linea;
            while ((linea = br.readLine()) != null) {
                String t = linea.trim();
                if (t.isEmpty() || t.startsWith("#")) continue;

                String[] f = t.split("-");
                if (f.length < 7) continue;

                try {
                    String idPedido = f[0].trim();
                    String fecha = f[1].trim();
                    int diaIndex = obtenerDiaIndex(fecha);
                    if (diaInicio != null && diaIndex < diaInicio) continue;
                    if (diaFin != null && diaIndex > diaFin) continue;

                    int hh = parsearEntero(f[2]);
                    int mm = parsearEntero(f[3]);
                    String destino = f[4].trim();

                    if (iatasValidas != null && !iatasValidas.contains(destino)) continue;

                    int cantidad = parsearEntero(f[5]);
                    String idCliente = f[6].trim();

                    Aeropuerto aeroOrigen = aeropuertos.get(origen);
                    Aeropuerto aeroDestino = aeropuertos.get(destino);
                    int sla = (aeroOrigen != null && aeroDestino != null)
                        ? aeroOrigen.calcularSla(aeroDestino)
                        : (obtenerContinente(origen).equals(obtenerContinente(destino)) ? 24 : 48);

                    String codigoGlobal = normalizarCodigoPedido(origen, idPedido);
                    envios.add(new Envio(codigoGlobal, origen, destino, fecha, hh, mm, cantidad, idCliente, sla, aeroOrigen));
                } catch (Exception e) {}
            }
        }
        return envios;
    }

    public List<Vuelo> instanciarVuelosPorRango(List<Vuelo> planes, int diaInicio, int diaFin) {
        List<Vuelo> instancias = new ArrayList<>();
        if (planes == null || planes.isEmpty() || diaFin < diaInicio) return instancias;

        int id = 0;
        for (int dia = diaInicio; dia <= diaFin; dia++) {
            int baseMin = dia * 24 * 60;
            String fecha = formatearFecha(dia);
            for (Vuelo plan : planes) {
                int salidaAbs = baseMin + plan.salidaMin;
                int llegadaAbs = baseMin + plan.llegadaMin;
                if (plan.llegadaMin < plan.salidaMin) llegadaAbs += 24 * 60;
                instancias.add(new Vuelo(id++, plan.origen, plan.destino, salidaAbs, llegadaAbs,
                    plan.capacidad, dia, fecha, plan.idPlan));
            }
        }
        return instancias;
    }

    public static String obtenerContinente(String codigoOACI) {
        char inicial = codigoOACI.toUpperCase().charAt(0);
        if (inicial == 'S' || inicial == 'K') return "AMERICA";
        if (inicial == 'E' || inicial == 'L') return "EUROPA";
        return "ASIA"; // Para O, V, U, etc.
    }

    public static int obtenerDiaIndex(String fecha) {
        LocalDate d = LocalDate.parse(fecha, FECHA_FORMAT);
        return (int) d.toEpochDay();
    }

    public static String formatearFecha(int diaIndex) {
        return LocalDate.ofEpochDay(diaIndex).format(FECHA_FORMAT);
    }

    public static String formatearHora(int minutos) {
        int h = Math.floorDiv(minutos, 60);
        int m = minutos - (h * 60);
        return String.format("%02d:%02d", h, m);
    }

    private static String extraerOrigenArchivo(String nombreArchivo) {
        Matcher m = PATRON_ORIGEN.matcher(nombreArchivo);
        if (m.find()) return m.group(1).toUpperCase(Locale.ROOT);
        return "EBCI";
    }

    private static String normalizarCodigoPedido(String origen, String idPedido) {
        String codigoOrigen = (origen == null || origen.isBlank())
            ? "EBCI"
            : origen.trim().toUpperCase(Locale.ROOT);
        String codigoPedido = (idPedido == null) ? "" : idPedido.trim();
        return codigoOrigen + "-" + codigoPedido;
    }
}
