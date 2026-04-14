package com.tasfb2b.simulador.domain.operaciones;

public record AcoResult(
        String idEnvio,
        Integer idPlan,
        boolean replanificado,
        int vuelosRuta,
        long minutosTotales,
        boolean slaCumplido
) {
}
