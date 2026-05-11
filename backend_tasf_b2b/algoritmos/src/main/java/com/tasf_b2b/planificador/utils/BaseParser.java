package com.tasf_b2b.planificador.utils;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.io.IOException;
import java.io.BufferedReader;
import java.io.InputStream;
import java.util.List;

public class BaseParser {
    private static volatile boolean mensajeCodificacionesMostrado = false;

    public int parsearEntero(String s) {
        String d = (s == null ? "" : s).replaceAll("[^0-9]", "");
        return d.isEmpty() ? 0 : Integer.parseInt(d);
    }

    public BufferedReader abrirReader(Path p) throws IOException {
        Charset charset = detectarEncodingPorBOM(p);
        return Files.newBufferedReader(p, charset);
    }

    private Charset detectarEncodingPorBOM(Path p) throws IOException {
        try (InputStream in = Files.newInputStream(p)) {
            byte[] b = in.readNBytes(3);
            if (b.length >= 2) {
                int b0 = b[0] & 0xFF;
                int b1 = b[1] & 0xFF;
                if (b0 == 0xFF && b1 == 0xFE) return StandardCharsets.UTF_16LE;
                if (b0 == 0xFE && b1 == 0xFF) return StandardCharsets.UTF_16BE;
            }
            if (b.length == 3) {
                int b0 = b[0] & 0xFF;
                int b1 = b[1] & 0xFF;
                int b2 = b[2] & 0xFF;
                if (b0 == 0xEF && b1 == 0xBB && b2 == 0xBF) return StandardCharsets.UTF_8;
            }
        }
        return StandardCharsets.UTF_8;
    }

    public List<String> leerLineas(Path p) throws IOException {
        if (!mensajeCodificacionesMostrado) {
            System.out.println("El sistema soporta codificaciones: UTF-8, UTF-16 e ISO_8859_1");
            mensajeCodificacionesMostrado = true;
        }
        
        List<Charset> encodings = List.of(
            StandardCharsets.UTF_8,
            StandardCharsets.UTF_16,
            StandardCharsets.ISO_8859_1
        );

        for (Charset charset : encodings) {
            try {
                List<String> lineas = Files.readAllLines(p, charset);
                
                // ISO_8859_1 no falla, se valida que no haya caracteres invalidos
                if (charset == StandardCharsets.ISO_8859_1) {
                    boolean tieneCaracteresRaros = lineas.stream()
                        .anyMatch(l -> l.chars().anyMatch(c -> c > 0x00FF));
                    if (tieneCaracteresRaros)
                        break;
                }
                
                // Log minimo (evita spam cuando se leen muchos archivos)
                //System.out.println("Encoding detectado: " + charset);
                return lineas;
                
            } catch (IOException ignored) {}
        }

        throw new IOException("Archivo con codificación no soportada: " + p.getFileName());
    }
}