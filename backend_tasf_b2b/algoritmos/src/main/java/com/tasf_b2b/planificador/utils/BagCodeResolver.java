package com.tasf_b2b.planificador.utils;

public final class BagCodeResolver {
    private BagCodeResolver() {
    }

    public static String normalize(String codigo) {
        if (codigo == null) {
            return null;
        }
        String trimmed = codigo.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static ParsedBagCode parse(String codigo) {
        String normalized = normalize(codigo);
        if (normalized == null) {
            return null;
        }

        int separator = normalized.lastIndexOf('-');
        if (separator <= 0 || separator == normalized.length() - 1) {
            return null;
        }

        if (normalized.lastIndexOf('-', separator - 1) <= 0) {
            return null;
        }

        String suffix = normalized.substring(separator + 1);
        if (!suffix.chars().allMatch(Character::isDigit)) {
            return null;
        }

        int numero;
        try {
            numero = Integer.parseInt(suffix);
        } catch (NumberFormatException ex) {
            return null;
        }

        if (numero <= 0) {
            return null;
        }

        String codigoPedido = normalized.substring(0, separator);
        if (codigoPedido.isBlank()) {
            return null;
        }

        return new ParsedBagCode(codigoPedido, normalized, numero);
    }

    public static boolean isValidBagNumber(int numeroMaleta, int totalMaletas) {
        return numeroMaleta > 0 && totalMaletas > 0 && numeroMaleta <= totalMaletas;
    }

    public static final class ParsedBagCode {
        public final String codigoPedido;
        public final String codigoMaleta;
        public final int numeroMaleta;

        private ParsedBagCode(String codigoPedido, String codigoMaleta, int numeroMaleta) {
            this.codigoPedido = codigoPedido;
            this.codigoMaleta = codigoMaleta;
            this.numeroMaleta = numeroMaleta;
        }
    }
}
