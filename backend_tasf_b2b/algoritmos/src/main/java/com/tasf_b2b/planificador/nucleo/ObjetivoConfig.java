package com.tasf_b2b.planificador.nucleo;

public final class ObjetivoConfig {
    private ObjetivoConfig() {
    }

    // Escala reducida para evitar overflow y mantener la misma proporcion relativa.
    public static final double PENALIDAD_SLA = 150.0;
    public static final double PENALIDAD_HORA_RETRASO = 2.5;
    public static final double PENALIDAD_SIN_RUTA = 10_000.0;
    public static final double PENALIDAD_CAP_VUELO = 120.0;
    public static final double PENALIDAD_CAP_ALMACEN = 120.0;

    public static final double PESO_TIEMPO = 1.0;
    public static final double PESO_ESCALAS = 5.0;

    public static final int MIN_ESCALA_MIN = 10;
    public static final int MIN_RECOJO_MIN = 10;

    public static void aplicar(ParametrosGa params) {
        params.penalidadSLA = PENALIDAD_SLA;
        params.penalidadHoraRetraso = PENALIDAD_HORA_RETRASO;
        params.penalidadSinRuta = PENALIDAD_SIN_RUTA;
        params.penalidadCapVuelo = PENALIDAD_CAP_VUELO;
        params.penalidadCapAlmacen = PENALIDAD_CAP_ALMACEN;
        params.pesoTiempo = PESO_TIEMPO;
        params.pesoEscalas = PESO_ESCALAS;
        params.minEscalaMin = MIN_ESCALA_MIN;
        params.minRecojoMin = MIN_RECOJO_MIN;
    }

    public static void aplicar(ParametrosAco params) {
        params.penalidadSLA = PENALIDAD_SLA;
        params.penalidadHoraRetraso = PENALIDAD_HORA_RETRASO;
        params.penalidadSinRuta = PENALIDAD_SIN_RUTA;
        params.penalidadCapVuelo = PENALIDAD_CAP_VUELO;
        params.penalidadCapAlmacen = PENALIDAD_CAP_ALMACEN;
        params.pesoTiempo = PESO_TIEMPO;
        params.pesoEscalas = PESO_ESCALAS;
        params.minEscalaMin = MIN_ESCALA_MIN;
        params.minRecojoMin = MIN_RECOJO_MIN;
    }
}
