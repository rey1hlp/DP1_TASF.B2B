package com.tasf_b2b.planificador.api.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class SimulationVirtualCancellationDto {
    public Long id;
    public String simulationId;
    public Long flightId;
    public String fecha;
    public String contextDate;
    public Integer contextMinuteOfDay;
    public Integer contextMinute;
    public String reason;
    public LocalDate fechaCancelacion;
    public LocalDateTime createdAt;
    public String flightCodigo;
    public String origen;
    public String destino;
}
