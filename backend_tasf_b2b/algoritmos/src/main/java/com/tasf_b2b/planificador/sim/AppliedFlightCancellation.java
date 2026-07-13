package com.tasf_b2b.planificador.sim;

import java.time.LocalDate;

public class AppliedFlightCancellation {
    public static final String SOURCE_REAL = "REAL";
    public static final String SOURCE_VIRTUAL = "VIRTUAL";

    public final Long flightId;
    public final LocalDate fechaCancelacion;
    public final String sourceType;
    public final Integer contextMinute;
    public final String reason;

    public AppliedFlightCancellation(
        Long flightId,
        LocalDate fechaCancelacion,
        String sourceType,
        Integer contextMinute,
        String reason
    ) {
        this.flightId = flightId;
        this.fechaCancelacion = fechaCancelacion;
        this.sourceType = sourceType;
        this.contextMinute = contextMinute;
        this.reason = reason;
    }
}
