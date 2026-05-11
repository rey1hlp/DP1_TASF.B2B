package com.tasf_b2b.planificador.utils;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.*;

import com.opencsv.CSVReader;
import com.tasf_b2b.planificador.dominio.Aeropuerto;

/**
 * Parser de aeropuertos.txt → aeropuertos.csv
 */
public class ParserAeropuertos extends BaseParser {

    // Regex para líneas de aeropuerto
    // Captura: oaci, nombre, pais, codigo_corto, gmt, capacidad, lat_str, lon_str
    private static final Pattern PATRON_AEROPUERTO = Pattern.compile(
        "^\\d+\\s+(\\w+)\\s+([\\p{L}\\s]+?)\\s{2,}([\\p{L}\\s.]+?)\\s{2,}(\\w+)\\s+([+\\-]\\d+)\\s+(\\d+)\\s+Latitude:\\s+(.+?)\\s+Longitude:\\s+(.+)",
        Pattern.UNICODE_CHARACTER_CLASS
    );

    // Regex para parsear DMS: "04° 42' 05\" N"
    private static final Pattern PATRON_DMS = Pattern.compile(
        "(\\d+)°\\s*(\\d+)[']\\s*([\\d.]+)[\"]\\s*([NSEW])"
    );

    public Map<String, Aeropuerto> fromCSVToRuntimeObjects(Path rutaCsv) throws IOException {
        Map<String, Aeropuerto> aeropuertos = new HashMap<>();

        try (CSVReader reader = new CSVReader(new FileReader(rutaCsv.toString()))) {
            reader.skip(1); // header
            for (String[] campos : reader) {
                Aeropuerto a = new Aeropuerto(
                    campos[0].strip(),
                    campos[1].strip(),
                    campos[2].strip(),
                    campos[3].strip(),
                    Integer.parseInt(campos[4].strip()),
                    Integer.parseInt(campos[5].strip()),
                    Double.parseDouble(campos[6].strip()),
                    Double.parseDouble(campos[7].strip()),
                    campos[8].strip()
                );
                aeropuertos.put(a.codigoOaci, a);
            }
        }

        return aeropuertos;
    }

    public void fromTXTtoCSV(Path rutaEntrada, Path rutaSalida) throws IOException {
        List<String[]> filas = parsear(rutaEntrada);
        escribirCsv(filas, rutaSalida);
 
        System.out.println((filas.size() - 1) + " aeropuertos exportados → " + rutaSalida);
    }

    private List<String[]> parsear(Path p) throws IOException {
        List<String[]> filas = new ArrayList<>();

        // Header
        filas.add(new String[]{
            "codigo_oaci", "nombre", "pais", "codigo_corto",
            "gmt", "capacidad", "latitud", "longitud", "continente"
        });

        String continenteActual = "";

        for (String linea : leerLineas(p)) {
            // Limpiar BOM y espacios
            String limpia = linea.replace("\uFEFF", "").strip();
            String lower = limpia.toLowerCase();

            // Detectar continente
            if (lower.contains("america del sur")) {
                continenteActual = "America del Sur";
                continue;
            } else if (lower.startsWith("europa")) {
                continenteActual = "Europa";
                continue;
            } else if (lower.startsWith("asia")) {
                continenteActual = "Asia";
                continue;
            }

            // Intentar parsear línea de aeropuerto
            Matcher m = PATRON_AEROPUERTO.matcher(limpia);
            if (!m.matches()) {
                //System.out.println("No se pudo procesar la linea porque no cumple el Regex");
                //System.out.println(linea);
                continue;
            }

            String oaci = m.group(1).strip();
            String nombre = m.group(2).strip();
            String pais = m.group(3).strip();
            String codCorto = m.group(4).strip();
            String gmt = m.group(5).strip();
            String capacidad = m.group(6).strip();
            String latStr = m.group(7).strip().replace("\uFEFF", "");
            String lonStr = m.group(8).strip().replace("\uFEFF", "");

            String latDecimal = parsearDms(latStr);
            String lonDecimal = parsearDms(lonStr);

            if (latDecimal == null || lonDecimal == null) {
                System.err.println("No se pudo parsear coordenadas de: " + oaci);
                continue;
            }

            filas.add(new String[] {
                    oaci, nombre, pais, codCorto,
                    gmt, capacidad, latDecimal, lonDecimal, continenteActual
            });
        }
        return filas;
    }

    /**
     * Convierte DMS ("04° 42' 05\" N") a decimal ("-4.701389")
     */
    private static String parsearDms(String dms) {
        Matcher m = PATRON_DMS.matcher(dms);
        if (!m.find()) return null;

        double grados   = Double.parseDouble(m.group(1));
        double minutos  = Double.parseDouble(m.group(2));
        double segundos = Double.parseDouble(m.group(3));
        String dir      = m.group(4);

        double decimal = grados + minutos / 60.0 + segundos / 3600.0;
        if (dir.equals("S") || dir.equals("W")) decimal = -decimal;

        return String.format("%.6f", decimal);
    }

    private static void escribirCsv(List<String[]> filas, Path rutaSalida) throws IOException {
        try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(rutaSalida.toString()), StandardCharsets.UTF_8))) {

            for (String[] fila : filas) {
                pw.println(String.join(",", escaparCsv(fila)));
            }
        }
    }

    /**
     * Escapa campos que contengan comas o comillas
     */
    private static String[] escaparCsv(String[] campos) {
        String[] resultado = new String[campos.length];
        for (int i = 0; i < campos.length; i++) {
            String campo = campos[i];
            if (campo.contains(",") || campo.contains("\"") || campo.contains("\n")) {
                campo = "\"" + campo.replace("\"", "\"\"") + "\"";
            }
            resultado[i] = campo;
        }
        return resultado;
    }
}