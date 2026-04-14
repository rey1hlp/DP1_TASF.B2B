package com.tasfb2b.simulador.domain.operaciones;

public record AcoBatchResult(
        int procesados,
        int planificados,
        int sinRuta
) {
}
