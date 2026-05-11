package com.tasf_b2b.planificador.utils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class RutaResolver {
    private RutaResolver() {
    }

    public static Path resolverRutaData(String raiz, String archivo) {
        Path directaArg = Paths.get(archivo);
        if (directaArg.isAbsolute() && Files.exists(directaArg)) {
            return directaArg;
        }
        Path relativa = Paths.get(raiz, archivo);
        if (Files.exists(relativa)) {
            return relativa;
        }
        Path directa = Paths.get(raiz, "data", archivo);
        if (Files.exists(directa)) {
            return directa;
        }
        Path conModulo = Paths.get(raiz, "genetico", "data", archivo);
        if (Files.exists(conModulo)) {
            return conModulo;
        }
        return directa;
    }

    public static Path resolverRutaSalida(String raiz, String archivo) {
        Path directaArg = Paths.get(archivo);
        if (directaArg.isAbsolute() && directaArg.getParent() != null && Files.exists(directaArg.getParent())) {
            return directaArg;
        }
        Path relativa = Paths.get(raiz, archivo);
        if (Files.exists(relativa.getParent())) {
            return relativa;
        }
        Path directa = Paths.get(raiz, "data", archivo);
        if (Files.exists(directa.getParent())) {
            return directa;
        }
        Path conModulo = Paths.get(raiz, "genetico", "data", archivo);
        if (Files.exists(conModulo.getParent())) {
            return conModulo;
        }
        return directa;
    }
}
