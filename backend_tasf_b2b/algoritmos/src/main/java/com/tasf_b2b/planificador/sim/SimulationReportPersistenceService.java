package com.tasf_b2b.planificador.sim;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.opencsv.CSVWriter;
import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.PasoRutaDto;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.api.dto.SimulationReportDtos;
import com.tasf_b2b.planificador.persistence.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SimulationReportPersistenceService {
    public static final String IMPACT_REASSIGNED = "REASSIGNED";
    public static final String IMPACT_WITHOUT_ROUTE = "WITHOUT_ROUTE";
    public static final String IMPACT_CANCELLED_SEGMENT_REMOVED = "CANCELLED_SEGMENT_REMOVED";

    private final SimulationRunRepository simulationRunRepository;
    private final FlightRepository flightRepository;
    private final SimulationReportSnapshotRepository snapshotRepository;
    private final SimulationReportMetricRepository metricRepository;
    private final SimulationReportRouteRepository routeRepository;
    private final SimulationReportRouteStepRepository stepRepository;
    private final SimulationReportFlightSegmentRepository flightSegmentRepository;
    private final SimulationReportCancellationRepository reportCancellationRepository;
    private final SimulationReportImpactRepository impactRepository;

    public SimulationReportPersistenceService(
        SimulationRunRepository simulationRunRepository,
        FlightRepository flightRepository,
        SimulationReportSnapshotRepository snapshotRepository,
        SimulationReportMetricRepository metricRepository,
        SimulationReportRouteRepository routeRepository,
        SimulationReportRouteStepRepository stepRepository,
        SimulationReportFlightSegmentRepository flightSegmentRepository,
        SimulationReportCancellationRepository reportCancellationRepository,
        SimulationReportImpactRepository impactRepository
    ) {
        this.simulationRunRepository = simulationRunRepository;
        this.flightRepository = flightRepository;
        this.snapshotRepository = snapshotRepository;
        this.metricRepository = metricRepository;
        this.routeRepository = routeRepository;
        this.stepRepository = stepRepository;
        this.flightSegmentRepository = flightSegmentRepository;
        this.reportCancellationRepository = reportCancellationRepository;
        this.impactRepository = impactRepository;
    }

    public void persistSnapshot(
        String simulationId,
        SimulationData data,
        List<AppliedFlightCancellation> appliedCancellations
    ) {
        if (simulationId == null || simulationId.isBlank() || data == null) {
            return;
        }
        SimulationRunEntity run = simulationRunRepository.findBySimulationId(simulationId);
        if (run == null || run.id == null) {
            return;
        }

        Optional<SimulationReportSnapshotEntity> previousSnapshot =
            snapshotRepository.findFirstBySimulationIdOrderByVersionNumberDesc(simulationId);
        Map<String, StoredRoute> previousRoutes = previousSnapshot
            .map(snapshot -> loadStoredRoutes(snapshot.id))
            .orElseGet(LinkedHashMap::new);

        int nextVersion = previousSnapshot.map(s -> s.versionNumber + 1).orElse(1);
        SimulationReportSnapshotEntity snapshot = new SimulationReportSnapshotEntity();
        snapshot.simulationRunId = run.id;
        snapshot.simulationId = simulationId;
        snapshot.versionNumber = nextVersion;
        snapshot.inicio = data.inicio;
        snapshot.fin = data.fin;
        snapshot.diaMin = data.diaMin;
        snapshot.diaMax = data.diaMax;
        snapshot.diasExtra = data.diasExtra;
        snapshot.totalEnvios = data.totalEnvios;
        snapshot.totalMaletas = data.totalMaletas;
        snapshot.speedMinPerSec = data.speedMinPerSec;
        snapshot = snapshotRepository.save(snapshot);

        saveFlightSegments(snapshot.id, data.vuelos);
        List<SimulationReportCancellationEntity> cancellations =
            saveCancellations(snapshot.id, appliedCancellations);
        Set<String> cancelledKeys = cancellations.stream()
            .map(c -> c.flightId + "|" + c.fechaCancelacion)
            .collect(Collectors.toSet());

        Map<String, RouteDraft> currentRoutes = buildRouteDrafts(data);
        List<SimulationReportImpactEntity> impacts =
            buildImpacts(snapshot.id, currentRoutes, previousRoutes, cancelledKeys);
        Set<String> impactedCodes = impacts.stream()
            .map(i -> i.codigoPedido)
            .collect(Collectors.toSet());

        saveRoutes(snapshot.id, currentRoutes, impactedCodes);
        impactRepository.saveAll(impacts);
        saveMetrics(snapshot.id, data, currentRoutes, cancellations.size(), impactedCodes.size());
    }

    @Transactional(readOnly = true)
    public SimulationReportDtos.Summary getSummary(String simulationId) {
        SimulationReportSnapshotEntity snapshot = getLatestSnapshot(simulationId);
        SimulationReportDtos.Summary dto = new SimulationReportDtos.Summary();
        dto.snapshotId = snapshot.id;
        dto.simulationId = snapshot.simulationId;
        dto.versionNumber = snapshot.versionNumber;
        dto.inicio = snapshot.inicio;
        dto.fin = snapshot.fin;
        dto.diaMin = snapshot.diaMin;
        dto.diaMax = snapshot.diaMax;
        dto.diasExtra = snapshot.diasExtra;
        dto.totalEnvios = snapshot.totalEnvios;
        dto.totalMaletas = snapshot.totalMaletas;
        dto.speedMinPerSec = snapshot.speedMinPerSec;
        dto.createdAt = snapshot.createdAt;
        dto.metrics = metricRepository.findBySnapshotIdOrderByMetricKey(snapshot.id).stream()
            .map(this::toMetricDto)
            .toList();
        dto.routeStatusCounts = toCountMap(routeRepository.countByStatus(snapshot.id));
        dto.impactTypeCounts = toCountMap(impactRepository.countByType(snapshot.id));
        dto.impactedRoutes = routeRepository.countBySnapshotIdAndImpactedTrue(snapshot.id);
        dto.cancellations = reportCancellationRepository
            .findBySnapshotIdOrderByFechaCancelacionAscFlightIdAsc(snapshot.id)
            .stream()
            .map(this::toCancellationDto)
            .toList();
        return dto;
    }

    @Transactional(readOnly = true)
    public Page<SimulationReportDtos.Route> searchRoutes(
        String simulationId,
        String estado,
        String query,
        boolean impactedOnly,
        Pageable pageable
    ) {
        SimulationReportSnapshotEntity snapshot = getLatestSnapshot(simulationId);
        return routeRepository.search(snapshot.id, estado, query, impactedOnly, pageable)
            .map(this::toRouteDto);
    }

    @Transactional(readOnly = true)
    public SimulationReportDtos.RouteDetail getRouteDetail(String simulationId, String codigoPedido) {
        SimulationReportSnapshotEntity snapshot = getLatestSnapshot(simulationId);
        SimulationReportRouteEntity route = routeRepository
            .findBySnapshotIdAndCodigoPedido(snapshot.id, codigoPedido)
            .orElseThrow(NoSuchElementException::new);
        SimulationReportDtos.RouteDetail dto = toRouteDetailDto(route);
        dto.steps = stepRepository.findByRouteIdOrderByStepIndex(route.id)
            .stream()
            .map(this::toStepDto)
            .toList();
        return dto;
    }

    @Transactional(readOnly = true)
    public Page<SimulationReportDtos.Impact> searchImpacts(
        String simulationId,
        String type,
        Pageable pageable
    ) {
        SimulationReportSnapshotEntity snapshot = getLatestSnapshot(simulationId);
        return impactRepository.search(snapshot.id, type, pageable).map(this::toImpactDto);
    }

    @Transactional(readOnly = true)
    public byte[] exportCsv(String simulationId, String section) {
        SimulationReportSnapshotEntity snapshot = getLatestSnapshot(simulationId);
        String normalized = (section == null || section.isBlank()) ? "all" : section.trim().toLowerCase(Locale.ROOT);
        StringWriter writer = new StringWriter();
        try (CSVWriter csv = new CSVWriter(writer)) {
            if ("summary".equals(normalized) || "all".equals(normalized)) {
                writeSummaryCsv(csv, snapshot);
                writeCancellationsCsv(csv, snapshot.id);
            }
            if ("routes".equals(normalized) || "all".equals(normalized)) {
                writeRoutesCsv(csv, snapshot.id);
            }
            if ("impacts".equals(normalized) || "all".equals(normalized)) {
                writeImpactsCsv(csv, snapshot.id);
            }
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo exportar CSV", ex);
        }
        return writer.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportPdf(String simulationId) {
        SimulationReportDtos.Summary summary = getSummary(simulationId);
        List<SimulationReportDtos.Impact> impacts = impactRepository
            .findBySnapshotIdOrderByCodigoPedido(summary.snapshotId)
            .stream()
            .limit(30)
            .map(this::toImpactDto)
            .toList();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document();
        try {
            PdfWriter.getInstance(document, out);
            document.open();
            document.add(new Paragraph("Reporte de Simulacion", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16)));
            document.add(new Paragraph("Simulacion: " + summary.simulationId));
            document.add(new Paragraph("Periodo: " + nullToDash(summary.inicio) + " - " + nullToDash(summary.fin)));
            document.add(new Paragraph("Version: " + summary.versionNumber));
            document.add(new Paragraph(" "));

            PdfPTable metrics = new PdfPTable(2);
            metrics.setWidthPercentage(100);
            addPdfHeader(metrics, "Indicador");
            addPdfHeader(metrics, "Valor");
            addPdfRow(metrics, "Total envios", String.valueOf(summary.totalEnvios));
            addPdfRow(metrics, "Total maletas", String.valueOf(summary.totalMaletas));
            addPdfRow(metrics, "Rutas impactadas", String.valueOf(summary.impactedRoutes));
            addPdfRow(metrics, "Cancelaciones aplicadas", String.valueOf(summary.cancellations.size()));
            for (SimulationReportDtos.Metric metric : summary.metrics) {
                addPdfRow(metrics, metric.label, metric.text != null ? metric.text : String.valueOf(metric.value));
            }
            document.add(metrics);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Cancelaciones", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13)));
            PdfPTable cancellations = new PdfPTable(6);
            cancellations.setWidthPercentage(100);
            addPdfHeader(cancellations, "Fecha");
            addPdfHeader(cancellations, "Fuente");
            addPdfHeader(cancellations, "Vuelo");
            addPdfHeader(cancellations, "Origen");
            addPdfHeader(cancellations, "Destino");
            addPdfHeader(cancellations, "ID");
            for (SimulationReportDtos.Cancellation cancellation : summary.cancellations) {
                addPdfRow(
                    cancellations,
                    String.valueOf(cancellation.fechaCancelacion),
                    nullToDash(cancellation.sourceType),
                    nullToDash(cancellation.flightCodigo),
                    nullToDash(cancellation.origen),
                    nullToDash(cancellation.destino),
                    String.valueOf(cancellation.flightId)
                );
            }
            document.add(cancellations);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Rutas de envios", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13)));
            document.add(new Paragraph("Se muestran hasta 100 rutas para mantener el PDF legible. El CSV contiene el detalle completo."));
            PdfPTable routeTable = new PdfPTable(6);
            routeTable.setWidthPercentage(100);
            addPdfHeader(routeTable, "Pedido");
            addPdfHeader(routeTable, "Estado");
            addPdfHeader(routeTable, "Origen");
            addPdfHeader(routeTable, "Destino");
            addPdfHeader(routeTable, "Tramos");
            addPdfHeader(routeTable, "Ruta");
            for (SimulationReportRouteEntity route : routeRepository.findTop100BySnapshotIdOrderByCodigoPedido(summary.snapshotId)) {
                List<SimulationReportRouteStepEntity> steps = stepRepository.findByRouteIdOrderByStepIndex(route.id);
                String routeText = steps.stream()
                    .map(step -> step.origen + ">" + step.destino)
                    .collect(Collectors.joining(" | "));
                addPdfRow(
                    routeTable,
                    route.codigoPedido,
                    route.estado,
                    nullToDash(route.origen),
                    nullToDash(route.destino),
                    String.valueOf(route.stepsCount),
                    routeText.isBlank() ? "-" : routeText
                );
            }
            document.add(routeTable);

            document.add(new Paragraph(" "));
            document.add(new Paragraph("Rutas impactadas principales", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13)));
            PdfPTable impactTable = new PdfPTable(4);
            impactTable.setWidthPercentage(100);
            addPdfHeader(impactTable, "Pedido");
            addPdfHeader(impactTable, "Tipo");
            addPdfHeader(impactTable, "Estado previo");
            addPdfHeader(impactTable, "Estado actual");
            for (SimulationReportDtos.Impact impact : impacts) {
                addPdfRow(
                    impactTable,
                    impact.codigoPedido,
                    impact.impactType,
                    nullToDash(impact.previousEstado),
                    nullToDash(impact.currentEstado)
                );
            }
            document.add(impactTable);
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo exportar PDF", ex);
        } finally {
            document.close();
        }
        return out.toByteArray();
    }

    private void saveFlightSegments(Long snapshotId, List<FlightSegmentDto> segments) {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        List<SimulationReportFlightSegmentEntity> entities = new ArrayList<>();
        for (FlightSegmentDto segment : segments) {
            if (segment == null) continue;
            SimulationReportFlightSegmentEntity entity = new SimulationReportFlightSegmentEntity();
            entity.snapshotId = snapshotId;
            entity.flightId = segment.flightId;
            entity.planId = (long) segment.planId;
            entity.origen = segment.origen;
            entity.destino = segment.destino;
            entity.salidaMin = segment.salidaMin;
            entity.llegadaMin = segment.llegadaMin;
            entity.carga = segment.carga;
            entity.capacidad = segment.capacidad;
            entity.origenLat = segment.origenLat;
            entity.origenLon = segment.origenLon;
            entity.destinoLat = segment.destinoLat;
            entity.destinoLon = segment.destinoLon;
            entities.add(entity);
        }
        flightSegmentRepository.saveAll(entities);
    }

    private List<SimulationReportCancellationEntity> saveCancellations(
        Long snapshotId,
        List<AppliedFlightCancellation> appliedCancellations
    ) {
        if (appliedCancellations == null || appliedCancellations.isEmpty()) {
            return List.of();
        }
        Set<Long> flightIds = appliedCancellations.stream()
            .map(c -> c.flightId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Long, FlightEntity> flights = flightRepository.findAllById(flightIds).stream()
            .collect(Collectors.toMap(f -> f.id, f -> f));
        List<SimulationReportCancellationEntity> entities = new ArrayList<>();
        for (AppliedFlightCancellation cancellation : appliedCancellations) {
            if (cancellation.flightId == null || cancellation.fechaCancelacion == null) continue;
            FlightEntity flight = flights.get(cancellation.flightId);
            SimulationReportCancellationEntity entity = new SimulationReportCancellationEntity();
            entity.snapshotId = snapshotId;
            entity.flightId = cancellation.flightId;
            entity.fechaCancelacion = cancellation.fechaCancelacion;
            entity.sourceType = cancellation.sourceType;
            entity.contextMinute = cancellation.contextMinute;
            entity.reason = cancellation.reason;
            if (flight != null) {
                entity.flightCodigo = flight.codigo;
                entity.origen = flight.origen != null ? flight.origen.codigoOaci : null;
                entity.destino = flight.destino != null ? flight.destino.codigoOaci : null;
                entity.salida = scheduledLocalDateTime(cancellation.fechaCancelacion, flight, true);
                entity.llegada = scheduledLocalDateTime(cancellation.fechaCancelacion, flight, false);
            }
            entities.add(entity);
        }
        return reportCancellationRepository.saveAll(entities);
    }

    private Map<String, RouteDraft> buildRouteDrafts(SimulationData data) {
        Map<String, RouteDraft> drafts = new LinkedHashMap<>();
        if (data.rutasPorPaquete == null) {
            return drafts;
        }
        for (Map.Entry<String, RespuestaRutaEnvioDto> entry : data.rutasPorPaquete.entrySet()) {
            RespuestaRutaEnvioDto route = entry.getValue();
            ShipmentCrudDto shipment = data.enviosPorCodigo != null ? data.enviosPorCodigo.get(entry.getKey()) : null;
            RouteDraft draft = new RouteDraft();
            draft.codigoPedido = entry.getKey();
            draft.estado = route != null && route.estado != null ? route.estado : "SIN_RUTA_ENCONTRADA";
            draft.tiempoTotalHoras = route != null ? route.tiempoTotalHoras : 0;
            draft.ingresoMin = route != null ? route.ingresoMin : 0;
            draft.totalMaletas = shipment != null ? shipment.cantidad : null;
            draft.steps = route != null && route.ruta != null ? route.ruta : List.of();
            if (!draft.steps.isEmpty()) {
                draft.origen = draft.steps.get(0).origen;
                draft.destino = draft.steps.get(draft.steps.size() - 1).destino;
            } else if (shipment != null) {
                draft.origen = shipment.origen;
                draft.destino = shipment.destino;
            }
            draft.signature = signature(draft.steps);
            drafts.put(draft.codigoPedido, draft);
        }
        return drafts;
    }

    private LocalDateTime scheduledLocalDateTime(LocalDate operationDate, FlightEntity flight, boolean departure) {
        if (operationDate == null || flight == null) {
            return null;
        }
        int originGmt = flight.origen != null ? flight.origen.gmt : 0;
        int destinationGmt = flight.destino != null ? flight.destino.gmt : originGmt;
        int departureLocalTotal = flight.salidaUtcOffsetMin + (originGmt * 60);
        int arrivalLocalTotal = flight.salidaUtcOffsetMin + flight.duracionMin + (destinationGmt * 60);
        int total = departure ? departureLocalTotal : arrivalLocalTotal;
        int dayOffset = Math.floorDiv(total, 1440) - Math.floorDiv(departureLocalTotal, 1440);
        int minute = Math.floorMod(total, 1440);
        return LocalDateTime.of(operationDate.plusDays(dayOffset), LocalTime.of(minute / 60, minute % 60));
    }

    private void saveRoutes(Long snapshotId, Map<String, RouteDraft> drafts, Set<String> impactedCodes) {
        List<SimulationReportRouteEntity> routeEntities = new ArrayList<>();
        for (RouteDraft draft : drafts.values()) {
            SimulationReportRouteEntity entity = new SimulationReportRouteEntity();
            entity.snapshotId = snapshotId;
            entity.codigoPedido = draft.codigoPedido;
            entity.estado = draft.estado;
            entity.tiempoTotalHoras = draft.tiempoTotalHoras;
            entity.ingresoMin = draft.ingresoMin;
            entity.totalMaletas = draft.totalMaletas;
            entity.origen = draft.origen;
            entity.destino = draft.destino;
            entity.stepsCount = draft.steps.size();
            entity.impacted = impactedCodes.contains(draft.codigoPedido);
            routeEntities.add(entity);
        }

        List<SimulationReportRouteEntity> savedRoutes = routeRepository.saveAll(routeEntities);
        Map<String, SimulationReportRouteEntity> byCode = savedRoutes.stream()
            .collect(Collectors.toMap(r -> r.codigoPedido, r -> r));
        List<SimulationReportRouteStepEntity> stepEntities = new ArrayList<>();
        for (RouteDraft draft : drafts.values()) {
            SimulationReportRouteEntity route = byCode.get(draft.codigoPedido);
            if (route == null || draft.steps == null) continue;
            for (int i = 0; i < draft.steps.size(); i++) {
                PasoRutaDto step = draft.steps.get(i);
                if (step == null) continue;
                SimulationReportRouteStepEntity entity = new SimulationReportRouteStepEntity();
                entity.routeId = route.id;
                entity.stepIndex = i;
                entity.vueloId = step.vueloId;
                entity.planId = step.planId != null ? step.planId.longValue() : null;
                entity.origen = step.origen;
                entity.destino = step.destino;
                entity.salidaMin = step.salidaMin;
                entity.llegadaMin = step.llegadaMin;
                entity.salidaAlmacenDestinoMin = step.salidaAlmacenDestinoMin;
                stepEntities.add(entity);
            }
        }
        stepRepository.saveAll(stepEntities);
    }

    private List<SimulationReportImpactEntity> buildImpacts(
        Long snapshotId,
        Map<String, RouteDraft> currentRoutes,
        Map<String, StoredRoute> previousRoutes,
        Set<String> cancelledKeys
    ) {
        List<SimulationReportImpactEntity> impacts = new ArrayList<>();
        for (RouteDraft current : currentRoutes.values()) {
            StoredRoute previous = previousRoutes.get(current.codigoPedido);
            if ("SIN_RUTA_ENCONTRADA".equalsIgnoreCase(current.estado)) {
                impacts.add(newImpact(
                    snapshotId,
                    current.codigoPedido,
                    IMPACT_WITHOUT_ROUTE,
                    previous != null ? previous.estado : null,
                    current.estado,
                    "El envio no tiene ruta encontrada en este snapshot.",
                    previous != null ? previous.signature : null,
                    current.signature,
                    null,
                    null
                ));
            }

            if (previous != null && !Objects.equals(previous.signature, current.signature)) {
                impacts.add(newImpact(
                    snapshotId,
                    current.codigoPedido,
                    IMPACT_REASSIGNED,
                    previous.estado,
                    current.estado,
                    "La secuencia de tramos cambio respecto del snapshot anterior.",
                    previous.signature,
                    current.signature,
                    null,
                    null
                ));
            }

            if (previous != null && !cancelledKeys.isEmpty()) {
                for (StoredStep step : previous.steps) {
                    if (step.planId == null) continue;
                    LocalDate date = LocalDate.ofEpochDay(Math.floorDiv(step.salidaMin, 1440));
                    String key = step.planId + "|" + date;
                    if (cancelledKeys.contains(key)) {
                        impacts.add(newImpact(
                            snapshotId,
                            current.codigoPedido,
                            IMPACT_CANCELLED_SEGMENT_REMOVED,
                            previous.estado,
                            current.estado,
                            "La ruta previa usaba un vuelo cancelado.",
                            previous.signature,
                            current.signature,
                            step.planId,
                            date
                        ));
                        break;
                    }
                }
            }
        }
        return impacts;
    }

    private SimulationReportImpactEntity newImpact(
        Long snapshotId,
        String codigoPedido,
        String type,
        String previousEstado,
        String currentEstado,
        String detail,
        String previousSignature,
        String currentSignature,
        Long flightId,
        LocalDate fechaCancelacion
    ) {
        SimulationReportImpactEntity entity = new SimulationReportImpactEntity();
        entity.snapshotId = snapshotId;
        entity.codigoPedido = codigoPedido;
        entity.impactType = type;
        entity.previousEstado = previousEstado;
        entity.currentEstado = currentEstado;
        entity.detail = detail;
        entity.previousRouteSignature = previousSignature;
        entity.currentRouteSignature = currentSignature;
        entity.flightId = flightId;
        entity.fechaCancelacion = fechaCancelacion;
        return entity;
    }

    private void saveMetrics(
        Long snapshotId,
        SimulationData data,
        Map<String, RouteDraft> routes,
        int cancellationsCount,
        int impactedCount
    ) {
        long delivered = routes.values().stream().filter(r -> "ENTREGADO".equalsIgnoreCase(r.estado)).count();
        long delayed = routes.values().stream().filter(r -> "CON_RETRASO".equalsIgnoreCase(r.estado)).count();
        long withoutRoute = routes.values().stream().filter(r -> "SIN_RUTA_ENCONTRADA".equalsIgnoreCase(r.estado)).count();
        List<SimulationReportMetricEntity> metrics = List.of(
            metric(snapshotId, "total_envios", "Total envios", (double) data.totalEnvios, String.valueOf(data.totalEnvios)),
            metric(snapshotId, "total_maletas", "Total maletas", (double) data.totalMaletas, String.valueOf(data.totalMaletas)),
            metric(snapshotId, "rutas_entregadas", "Rutas entregadas", (double) delivered, String.valueOf(delivered)),
            metric(snapshotId, "rutas_con_retraso", "Rutas con retraso", (double) delayed, String.valueOf(delayed)),
            metric(snapshotId, "rutas_sin_ruta", "Rutas sin ruta", (double) withoutRoute, String.valueOf(withoutRoute)),
            metric(snapshotId, "vuelos_planificados", "Vuelos planificados", (double) (data.vuelos != null ? data.vuelos.size() : 0), String.valueOf(data.vuelos != null ? data.vuelos.size() : 0)),
            metric(snapshotId, "cancelaciones_aplicadas", "Cancelaciones aplicadas", (double) cancellationsCount, String.valueOf(cancellationsCount)),
            metric(snapshotId, "rutas_impactadas", "Rutas impactadas", (double) impactedCount, String.valueOf(impactedCount))
        );
        metricRepository.saveAll(metrics);
    }

    private SimulationReportMetricEntity metric(Long snapshotId, String key, String label, Double value, String text) {
        SimulationReportMetricEntity entity = new SimulationReportMetricEntity();
        entity.snapshotId = snapshotId;
        entity.metricKey = key;
        entity.metricLabel = label;
        entity.metricValue = value;
        entity.metricText = text;
        return entity;
    }

    private Map<String, StoredRoute> loadStoredRoutes(Long snapshotId) {
        List<SimulationReportRouteEntity> routes = routeRepository.findBySnapshotIdOrderByCodigoPedido(snapshotId);
        List<Long> routeIds = routes.stream().map(r -> r.id).toList();
        Map<Long, List<SimulationReportRouteStepEntity>> stepsByRoute = stepRepository
            .findByRouteIdInOrderByRouteIdAscStepIndexAsc(routeIds)
            .stream()
            .collect(Collectors.groupingBy(s -> s.routeId, LinkedHashMap::new, Collectors.toList()));

        Map<String, StoredRoute> result = new LinkedHashMap<>();
        for (SimulationReportRouteEntity route : routes) {
            List<StoredStep> steps = stepsByRoute.getOrDefault(route.id, List.of()).stream()
                .map(s -> new StoredStep(s.planId, s.salidaMin, s.origen, s.destino, s.llegadaMin))
                .toList();
            result.put(route.codigoPedido, new StoredRoute(route.estado, signatureStored(steps), steps));
        }
        return result;
    }

    private SimulationReportSnapshotEntity getLatestSnapshot(String simulationId) {
        return snapshotRepository.findFirstBySimulationIdOrderByVersionNumberDesc(simulationId)
            .orElseThrow(NoSuchElementException::new);
    }

    private String signature(List<PasoRutaDto> steps) {
        if (steps == null || steps.isEmpty()) {
            return "";
        }
        return steps.stream()
            .map(s -> (s.planId != null ? s.planId : -1) + ":" + s.origen + ">" + s.destino + ":" + s.salidaMin + "-" + s.llegadaMin)
            .collect(Collectors.joining("|"));
    }

    private String signatureStored(List<StoredStep> steps) {
        if (steps == null || steps.isEmpty()) {
            return "";
        }
        return steps.stream()
            .map(s -> (s.planId != null ? s.planId : -1) + ":" + s.origen + ">" + s.destino + ":" + s.salidaMin + "-" + s.llegadaMin)
            .collect(Collectors.joining("|"));
    }

    private SimulationReportDtos.Metric toMetricDto(SimulationReportMetricEntity entity) {
        SimulationReportDtos.Metric dto = new SimulationReportDtos.Metric();
        dto.key = entity.metricKey;
        dto.label = entity.metricLabel;
        dto.value = entity.metricValue;
        dto.text = entity.metricText;
        return dto;
    }

    private SimulationReportDtos.Route toRouteDto(SimulationReportRouteEntity entity) {
        SimulationReportDtos.Route dto = new SimulationReportDtos.Route();
        dto.id = entity.id;
        dto.codigoPedido = entity.codigoPedido;
        dto.estado = entity.estado;
        dto.tiempoTotalHoras = entity.tiempoTotalHoras;
        dto.ingresoMin = entity.ingresoMin;
        dto.totalMaletas = entity.totalMaletas;
        dto.origen = entity.origen;
        dto.destino = entity.destino;
        dto.stepsCount = entity.stepsCount;
        dto.impacted = entity.impacted;
        return dto;
    }

    private SimulationReportDtos.RouteDetail toRouteDetailDto(SimulationReportRouteEntity entity) {
        SimulationReportDtos.Route base = toRouteDto(entity);
        SimulationReportDtos.RouteDetail dto = new SimulationReportDtos.RouteDetail();
        dto.id = base.id;
        dto.codigoPedido = base.codigoPedido;
        dto.estado = base.estado;
        dto.tiempoTotalHoras = base.tiempoTotalHoras;
        dto.ingresoMin = base.ingresoMin;
        dto.totalMaletas = base.totalMaletas;
        dto.origen = base.origen;
        dto.destino = base.destino;
        dto.stepsCount = base.stepsCount;
        dto.impacted = base.impacted;
        return dto;
    }

    private SimulationReportDtos.RouteStep toStepDto(SimulationReportRouteStepEntity entity) {
        SimulationReportDtos.RouteStep dto = new SimulationReportDtos.RouteStep();
        dto.stepIndex = entity.stepIndex;
        dto.vueloId = entity.vueloId;
        dto.planId = entity.planId;
        dto.origen = entity.origen;
        dto.destino = entity.destino;
        dto.salidaMin = entity.salidaMin;
        dto.llegadaMin = entity.llegadaMin;
        dto.salidaAlmacenDestinoMin = entity.salidaAlmacenDestinoMin;
        return dto;
    }

    private SimulationReportDtos.Impact toImpactDto(SimulationReportImpactEntity entity) {
        SimulationReportDtos.Impact dto = new SimulationReportDtos.Impact();
        dto.id = entity.id;
        dto.codigoPedido = entity.codigoPedido;
        dto.impactType = entity.impactType;
        dto.previousEstado = entity.previousEstado;
        dto.currentEstado = entity.currentEstado;
        dto.detail = entity.detail;
        dto.flightId = entity.flightId;
        dto.fechaCancelacion = entity.fechaCancelacion;
        return dto;
    }

    private SimulationReportDtos.Cancellation toCancellationDto(SimulationReportCancellationEntity entity) {
        SimulationReportDtos.Cancellation dto = new SimulationReportDtos.Cancellation();
        dto.id = entity.id;
        dto.flightId = entity.flightId;
        dto.fechaCancelacion = entity.fechaCancelacion;
        dto.sourceType = entity.sourceType;
        dto.contextMinute = entity.contextMinute;
        dto.reason = entity.reason;
        dto.flightCodigo = entity.flightCodigo;
        dto.origen = entity.origen;
        dto.destino = entity.destino;
        dto.salida = entity.salida;
        dto.llegada = entity.llegada;
        return dto;
    }

    private Map<String, Long> toCountMap(List<Object[]> rows) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) continue;
            result.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        return result;
    }

    private void writeSummaryCsv(CSVWriter csv, SimulationReportSnapshotEntity snapshot) {
        csv.writeNext(new String[] {"section", "key", "value"});
        csv.writeNext(new String[] {"summary", "simulation_id", snapshot.simulationId});
        csv.writeNext(new String[] {"summary", "version", String.valueOf(snapshot.versionNumber)});
        csv.writeNext(new String[] {"summary", "inicio", snapshot.inicio});
        csv.writeNext(new String[] {"summary", "fin", snapshot.fin});
        csv.writeNext(new String[] {"summary", "total_envios", String.valueOf(snapshot.totalEnvios)});
        csv.writeNext(new String[] {"summary", "total_maletas", String.valueOf(snapshot.totalMaletas)});
        for (SimulationReportMetricEntity metric : metricRepository.findBySnapshotIdOrderByMetricKey(snapshot.id)) {
            csv.writeNext(new String[] {"metric", metric.metricKey, metric.metricText != null ? metric.metricText : String.valueOf(metric.metricValue)});
        }
        csv.writeNext(new String[] {});
    }

    private void writeRoutesCsv(CSVWriter csv, Long snapshotId) {
        csv.writeNext(new String[] {"codigo_pedido", "estado", "origen", "destino", "maletas", "tiempo_total_horas", "ingreso_min", "tramos", "impactada"});
        for (SimulationReportRouteEntity route : routeRepository.findBySnapshotIdOrderByCodigoPedido(snapshotId)) {
            csv.writeNext(new String[] {
                route.codigoPedido,
                route.estado,
                route.origen,
                route.destino,
                route.totalMaletas != null ? String.valueOf(route.totalMaletas) : "",
                String.valueOf(route.tiempoTotalHoras),
                String.valueOf(route.ingresoMin),
                String.valueOf(route.stepsCount),
                String.valueOf(route.impacted)
            });
            for (SimulationReportRouteStepEntity step : stepRepository.findByRouteIdOrderByStepIndex(route.id)) {
                csv.writeNext(new String[] {
                    route.codigoPedido + "#step",
                    String.valueOf(step.stepIndex),
                    step.origen,
                    step.destino,
                    step.planId != null ? String.valueOf(step.planId) : "",
                    String.valueOf(step.vueloId),
                    String.valueOf(step.salidaMin),
                    String.valueOf(step.llegadaMin),
                    String.valueOf(step.salidaAlmacenDestinoMin)
                });
            }
        }
        csv.writeNext(new String[] {});
    }

    private void writeCancellationsCsv(CSVWriter csv, Long snapshotId) {
        csv.writeNext(new String[] {"fecha_cancelacion", "source_type", "flight_id", "flight_codigo", "origen", "destino", "context_minute", "reason"});
        for (SimulationReportCancellationEntity cancellation
            : reportCancellationRepository.findBySnapshotIdOrderByFechaCancelacionAscFlightIdAsc(snapshotId)) {
            csv.writeNext(new String[] {
                cancellation.fechaCancelacion != null ? String.valueOf(cancellation.fechaCancelacion) : "",
                cancellation.sourceType,
                cancellation.flightId != null ? String.valueOf(cancellation.flightId) : "",
                cancellation.flightCodigo,
                cancellation.origen,
                cancellation.destino,
                cancellation.contextMinute != null ? String.valueOf(cancellation.contextMinute) : "",
                cancellation.reason
            });
        }
        csv.writeNext(new String[] {});
    }

    private void writeImpactsCsv(CSVWriter csv, Long snapshotId) {
        csv.writeNext(new String[] {"codigo_pedido", "impact_type", "previous_estado", "current_estado", "flight_id", "fecha_cancelacion", "detail"});
        for (SimulationReportImpactEntity impact : impactRepository.findBySnapshotIdOrderByCodigoPedido(snapshotId)) {
            csv.writeNext(new String[] {
                impact.codigoPedido,
                impact.impactType,
                impact.previousEstado,
                impact.currentEstado,
                impact.flightId != null ? String.valueOf(impact.flightId) : "",
                impact.fechaCancelacion != null ? String.valueOf(impact.fechaCancelacion) : "",
                impact.detail
            });
        }
    }

    private void addPdfHeader(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)));
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(cell);
    }

    private void addPdfRow(PdfPTable table, String... values) {
        for (String value : values) {
            table.addCell(new Phrase(nullToDash(value), FontFactory.getFont(FontFactory.HELVETICA, 8)));
        }
    }

    private String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private record StoredRoute(String estado, String signature, List<StoredStep> steps) {}

    private record StoredStep(Long planId, int salidaMin, String origen, String destino, int llegadaMin) {}

    private static class RouteDraft {
        String codigoPedido;
        String estado;
        double tiempoTotalHoras;
        int ingresoMin;
        Integer totalMaletas;
        String origen;
        String destino;
        List<PasoRutaDto> steps = List.of();
        String signature;
    }
}
