package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;
import com.tasf_b2b.planificador.api.dto.DailyShipmentSummaryDto;
import com.tasf_b2b.planificador.api.dto.DailyWarehouseSnapshotDto;
import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.OperationAlertDto;
    import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.persistence.ShipmentStatus;

import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DailyOperationService {
    private static final Logger log = LoggerFactory.getLogger(DailyOperationService.class);
    private static final ZoneId ZONE = ZoneId.of("America/Lima");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final AirportRepository airportRepository;
    private final ShipmentRepository shipmentRepository;
    private final DailyPlanningService dailyPlanningService;

    public DailyOperationService(
        AirportRepository airportRepository,
        ShipmentRepository shipmentRepository,
        DailyPlanningService dailyPlanningService
    ) {
        this.airportRepository = airportRepository;
        this.shipmentRepository = shipmentRepository;
        this.dailyPlanningService = dailyPlanningService;
    }

    public DailyOperationSnapshotDto buildSnapshot(String dateText, String airportText, String windowText) {
        LocalDate selectedDate = parseDate(dateText);
        String airportFilter = normalizeAirport(airportText);

        OffsetDateTime now = OffsetDateTime.now(ZONE);
        int currentMinute = now.getHour() * 60 + now.getMinute();
        log.info(
            "[DAILY_OP] buildSnapshot dateText={} airportText={} windowText={} selectedDate={} airportFilter={} currentMinute={}",
            dateText,
            airportText,
            windowText,
            selectedDate,
            airportFilter,
            currentMinute
        );

        Map<String, AirportEntity> airportEntities = airportRepository.findAll().stream()
            .filter(entity -> entity.codigoOaci != null && !entity.codigoOaci.isBlank())
            .collect(Collectors.toMap(
                entity -> entity.codigoOaci.trim().toUpperCase(Locale.ROOT),
                entity -> entity,
                (left, right) -> left,
                LinkedHashMap::new
            ));

        List<ShipmentEntity> shipments = shipmentRepository.findAll().stream()
            .filter(this::isValidShipment)
            .filter(shipment -> selectedDate == null || selectedDate.toString().replace("-", "").equals(shipment.fecha))
            .filter(shipment -> airportFilter == null
                || airportFilter.equals(shipmentOrigen(shipment))
                || airportFilter.equals(shipmentDestino(shipment)))
            .collect(Collectors.toList());
        log.info("[DAILY_OP] shipments matched snapshot={}", shipments.size());

        List<FlightSegmentDto> segments = dailyPlanningService.getCurrentPlanSegments().stream()
            .filter(segment -> airportFilter == null
                || airportFilter.equals(normalizeAirport(segment.origen))
                || airportFilter.equals(normalizeAirport(segment.destino)))
            .sorted(Comparator.comparingInt(segment -> segment.salidaMin))
            .collect(Collectors.toList());
        log.info("[DAILY_OP] segments matched snapshot={}", segments.size());

        Map<String, DailyWarehouseSnapshotDto> warehouseSnapshot = buildWarehouseSnapshot(
            airportEntities,
            shipments,
            airportFilter
        );

        DailyShipmentSummaryDto shipmentSummary = buildShipmentSummary(shipments);

        List<OperationAlertDto> alerts = buildAlerts(warehouseSnapshot);
        log.info("[DAILY_OP] alerts generated={}", alerts.size());

        DailyOperationSnapshotDto snapshot = new DailyOperationSnapshotDto();
        snapshot.timestamp = TIMESTAMP_FORMAT.format(now);
        snapshot.currentMinute = currentMinute;
        snapshot.segments = segments;
        snapshot.warehouseSnapshot = warehouseSnapshot;
        snapshot.shipmentSummary = shipmentSummary;
        snapshot.alerts = alerts;
        snapshot.envios = shipments.stream().map(this::toShipmentDto).collect(Collectors.toList());
        return snapshot;
    }

    private Map<String, DailyWarehouseSnapshotDto> buildWarehouseSnapshot(
        Map<String, AirportEntity> airportEntities,
        List<ShipmentEntity> shipments,
        String airportFilter
    ) {
        Map<String, Long> ocupacionPorAeropuerto = new HashMap<>();

        for (ShipmentEntity shipment : shipments) {
            String origen = shipmentOrigen(shipment);
            if (origen == null) {
                continue;
            }
            if (shipment.status != ShipmentStatus.PENDING && shipment.status != ShipmentStatus.CANCELLED) {
                continue;
            }
            ocupacionPorAeropuerto.merge(origen, (long) Math.max(0, shipment.cantidad), Long::sum);
        }
        log.info("[DAILY_OP] warehouse occupancy airports={}", ocupacionPorAeropuerto.size());

        Map<String, DailyWarehouseSnapshotDto> result = new LinkedHashMap<>();
        for (AirportEntity airport : airportEntities.values()) {
            String codigo = normalizeAirport(airport.codigoOaci);
            if (airportFilter != null && !airportFilter.equals(codigo)) {
                continue;
            }

            long ocupacion = ocupacionPorAeropuerto.getOrDefault(codigo, 0L);
            int capacidad = Math.max(1, airport.capacidad);
            long libre = Math.max(0L, capacidad - ocupacion);
            double porcentaje = (ocupacion * 100.0) / capacidad;

            DailyWarehouseSnapshotDto dto = new DailyWarehouseSnapshotDto();
            dto.capacidad = capacidad;
            dto.ocupacion = ocupacion;
            dto.libre = libre;
            dto.porcentaje = porcentaje;
            result.put(codigo, dto);
        }

        return result;
    }
    
    private DailyShipmentSummaryDto buildShipmentSummary(List<ShipmentEntity> shipments) {
        long total     = shipments.stream().mapToLong(this::cantidadSegura).sum();
        long pending   = shipments.stream()
            .filter(s -> s.status == ShipmentStatus.PENDING)
            .mapToLong(this::cantidadSegura).sum();
        long inTransit = shipments.stream()
            .filter(s -> s.status == ShipmentStatus.IN_TRANSIT)
            .mapToLong(this::cantidadSegura).sum();
        long delivered = shipments.stream()
            .filter(s -> s.status == ShipmentStatus.DELIVERED)
            .mapToLong(this::cantidadSegura).sum();
    
        DailyShipmentSummaryDto dto = new DailyShipmentSummaryDto();
        dto.total     = total;
        dto.pending   = pending;
        dto.inTransit = inTransit;
        dto.delivered = delivered;
        return dto;
    }

    private List<OperationAlertDto> buildAlerts(Map<String, DailyWarehouseSnapshotDto> warehouseSnapshot) {
        List<OperationAlertDto> alerts = new ArrayList<>();

        for (Map.Entry<String, DailyWarehouseSnapshotDto> entry : warehouseSnapshot.entrySet()) {
            DailyWarehouseSnapshotDto warehouse = entry.getValue();
            if (warehouse.porcentaje < 80.0) {
                continue;
            }

            OperationAlertDto alert = new OperationAlertDto();
            alert.id = "AL-" + entry.getKey();
            alert.severity = warehouse.porcentaje >= 95.0 ? "CRITICAL" : "WARNING";
            alert.message = "Alta ocupacion en almacen " + entry.getKey();
            alert.createdAt = OffsetDateTime.now(ZONE).format(TIMESTAMP_FORMAT);
            alerts.add(alert);
        }

        return alerts;
    }

    private boolean isValidShipment(ShipmentEntity shipment) {
        return shipment != null
            && shipment.codigoPedido != null && !shipment.codigoPedido.isBlank()
            && shipmentOrigen(shipment) != null
            && shipmentDestino(shipment) != null
            && shipment.fecha != null && !shipment.fecha.isBlank();
    }

    private String shipmentOrigen(ShipmentEntity shipment) {
        return shipment != null && shipment.origen != null ? normalizeAirport(shipment.origen.codigoOaci) : null;
    }

    private String shipmentDestino(ShipmentEntity shipment) {
        return shipment != null && shipment.destino != null ? normalizeAirport(shipment.destino.codigoOaci) : null;
    }

    private int cantidadSegura(ShipmentEntity shipment) {
        return shipment != null ? Math.max(0, shipment.cantidad) : 0;
    }

    private LocalDate parseDate(String dateText) {
        if (dateText == null || dateText.isBlank()) {
            return null;
        }
        return LocalDate.parse(dateText.trim(), DATE_FORMAT);
    }

    private String normalizeAirport(String airportCode) {
        if (airportCode == null || airportCode.isBlank()) {
            return null;
        }
        return airportCode.trim().toUpperCase(Locale.ROOT);
    }

    private ShipmentCrudDto toShipmentDto(ShipmentEntity entity) {
        ShipmentCrudDto dto = new ShipmentCrudDto();
        dto.id = entity.id;
        dto.codigoPedido = entity.codigoPedido;
        dto.origen = entity.origen != null ? entity.origen.codigoOaci : null;
        dto.origenCiudad = entity.origen != null ? entity.origen.ciudad : null;
        dto.destino = entity.destino != null ? entity.destino.codigoOaci : null;
        dto.destinoCiudad = entity.destino != null ? entity.destino.ciudad : null;
        dto.fecha = entity.fecha;
        dto.ingresoUtc = entity.ingresoUtc;
        dto.ingresoLocal = entity.ingresoLocal;
        dto.gmtOffset = entity.gmtOffset;
        dto.cantidad = entity.cantidad;
        dto.idCliente = entity.idCliente;
        dto.slaHoras = entity.slaHoras;
        dto.status = entity.status;
        dto.auditDateIns = entity.auditDateIns;
        return dto;
    }
}
