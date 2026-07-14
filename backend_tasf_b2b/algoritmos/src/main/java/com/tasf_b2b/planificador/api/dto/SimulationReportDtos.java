package com.tasf_b2b.planificador.api.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SimulationReportDtos {
    public static class Summary {
        public Long snapshotId;
        public String simulationId;
        public int versionNumber;
        public String inicio;
        public String fin;
        public Integer diaMin;
        public Integer diaMax;
        public Integer diasExtra;
        public int totalEnvios;
        public long totalMaletas;
        public Double speedMinPerSec;
        public LocalDateTime createdAt;
        public List<Metric> metrics = new ArrayList<>();
        public Map<String, Long> routeStatusCounts;
        public Map<String, Long> impactTypeCounts;
        public long impactedRoutes;
        public List<Cancellation> cancellations = new ArrayList<>();
    }

    public static class Metric {
        public String key;
        public String label;
        public Double value;
        public String text;
    }

    public static class Route {
        public Long id;
        public String codigoPedido;
        public String estado;
        public double tiempoTotalHoras;
        public int ingresoMin;
        public Integer totalMaletas;
        public String origen;
        public String destino;
        public int stepsCount;
        public boolean impacted;
    }

    public static class RouteDetail extends Route {
        public List<RouteStep> steps = new ArrayList<>();
    }

    public static class RouteStep {
        public int stepIndex;
        public int vueloId;
        public Long planId;
        public String origen;
        public String destino;
        public int salidaMin;
        public int llegadaMin;
        public int salidaAlmacenDestinoMin;
    }

    public static class Impact {
        public Long id;
        public String codigoPedido;
        public String impactType;
        public String previousEstado;
        public String currentEstado;
        public String detail;
        public Long flightId;
        public LocalDate fechaCancelacion;
    }

    public static class Cancellation {
        public Long id;
        public Long flightId;
        public LocalDate fechaCancelacion;
        public String sourceType;
        public Integer contextMinute;
        public String reason;
        public String flightCodigo;
        public String origen;
        public String destino;
        public LocalDateTime salida;
        public LocalDateTime llegada;
    }
}
