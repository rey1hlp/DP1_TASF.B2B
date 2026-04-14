package com.tasfb2b.simulador.domain.operaciones;

public record AcoConfig(
        int hormigas,
        int iteraciones,
        double alfa,
        double beta,
        double tasaEvaporacion,
        double feromonaInicial
) {
    public static AcoConfig defaults() {
        return new AcoConfig(24, 35, 1.0, 2.0, 0.15, 1.0);
    }
}
