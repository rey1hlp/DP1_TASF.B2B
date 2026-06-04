package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;
import com.tasf_b2b.planificador.api.dto.DailyShipmentSummaryDto;
import com.tasf_b2b.planificador.api.dto.DailyWarehouseSnapshotDto;
import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.OperationAlertDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import org.springframework.stereotype.Service;

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
    private static final ZoneId ZONE = ZoneId.of("America/Lima");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final AirportRepository airportRepository;
    private final FlightRepository flightRepository;
    private final ShipmentRepository shipmentRepository;

    public DailyOperationService(
        AirportRepository airportRepository,
        FlightRepository flightRepository,
        ShipmentRepository shipmentRepository
    ) {
        this.airportRepository = airportRepository;
        this.flightRepository = flightRepository;
        this.shipmentRepository = shipmentRepository;
    }

    public DailyOperationSnapshotDto buildSnapshot(String dateText, String airportText, String windowText) {
        LocalDate selectedDate = parseDate(dateText);
        String airportFilter = normalizeAirport(airportText);

        OffsetDateTime now = OffsetDateTime.now(ZONE);
        int currentMinute = now.getHour() * 60 + now.getMinute();

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
                || airportFilter.equals(normalizeAirport(shipment.origen))
                || airportFilter.equals(normalizeAirport(shipment.destino)))
            .collect(Collectors.toList());

        List<FlightSegmentDto> segments = flightRepository.findAll().stream()
            .filter(this::isValidFlight)
            .map(entity -> toSegment(entity, airportEntities))
            .filter(segment -> segment != null)
            .filter(segment -> airportFilter == null
                || airportFilter.equals(normalizeAirport(segment.origen))
                || airportFilter.equals(normalizeAirport(segment.destino)))
            .sorted(Comparator.comparingInt(segment -> segment.salidaMin))
            .collect(Collectors.toList());

        Map<String, DailyWarehouseSnapshotDto> warehouseSnapshot = buildWarehouseSnapshot(
            airportEntities,
            shipments,
            airportFilter
        );

        DailyShipmentSummaryDto shipmentSummary = buildShipmentSummary(shipments);

        List<OperationAlertDto> alerts = buildAlerts(warehouseSnapshot);

        DailyOperationSnapshotDto snapshot = new DailyOperationSnapshotDto();
        snapshot.timestamp = TIMESTAMP_FORMAT.format(now);
        snapshot.currentMinute = currentMinute;
        snapshot.segments = segments;
        snapshot.warehouseSnapshot = warehouseSnapshot;
        snapshot.shipmentSummary = shipmentSummary;
        snapshot.alerts = alerts;
        return snapshot;
    }

    private Map<String, DailyWarehouseSnapshotDto> buildWarehouseSnapshot(
        Map<String, AirportEntity> airportEntities,
        List<ShipmentEntity> shipments,
        String airportFilter
    ) {
        Map<String, Long> ocupacionPorAeropuerto = new HashMap<>();

        for (ShipmentEntity shipment : shipments) {
            if (shipment.origen == null || shipment.origen.isBlank()) {
                continue;
            }
            if (shipment.asignado) {
                continue;
            }
            String codigo = normalizeAirport(shipment.origen);
            ocupacionPorAeropuerto.merge(codigo, (long) Math.max(0, shipment.cantidad), Long::sum);
        }

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
        long total = shipments.stream().mapToLong(this::cantidadSegura).sum();
        long pending = shipments.stream()
            .filter(shipment -> !shipment.asignado)
            .mapToLong(this::cantidadSegura)
            .sum();
        long inTransit = shipments.stream()
            .filter(shipment -> shipment.asignado)
            .mapToLong(this::cantidadSegura)
            .sum();
        long delivered = Math.max(0L, total - pending - inTransit);

        DailyShipmentSummaryDto dto = new DailyShipmentSummaryDto();
        dto.total = total;
        dto.pending = pending;
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

    private FlightSegmentDto toSegment(FlightEntity entity, Map<String, AirportEntity> airports) {
        if (entity.origen == null || entity.destino == null || entity.salida == null || entity.llegada == null) {
            return null;
        }

        String origen = normalizeAirport(entity.origen.codigoOaci);
        String destino = normalizeAirport(entity.destino.codigoOaci);

        if (origen == null || destino == null) {
            return null;
        }

        FlightSegmentDto segment = new FlightSegmentDto();
        segment.flightId = entity.id != null ? entity.id.intValue() : 0;
        segment.planId = entity.id != null ? entity.id.intValue() : 0;
        segment.origen = origen;
        segment.destino = destino;
        segment.salidaMin = entity.salida.getHour() * 60 + entity.salida.getMinute();
        segment.llegadaMin = entity.llegada.getHour() * 60 + entity.llegada.getMinute();
        segment.carga = 0L;
        segment.capacidad = entity.capacidad;

        AirportEntity origenEntity = airports.get(origen);
        AirportEntity destinoEntity = airports.get(destino);
        if (origenEntity != null) {
            segment.origenLat = origenEntity.latitud;
            segment.origenLon = origenEntity.longitud;
        }
        if (destinoEntity != null) {
            segment.destinoLat = destinoEntity.latitud;
            segment.destinoLon = destinoEntity.longitud;
        }

        return segment;
    }

    private boolean isValidShipment(ShipmentEntity shipment) {
        return shipment != null
            && shipment.codigoPedido != null && !shipment.codigoPedido.isBlank()
            && shipment.origen != null && !shipment.origen.isBlank()
            && shipment.destino != null && !shipment.destino.isBlank()
            && shipment.fecha != null && !shipment.fecha.isBlank();
    }

    private boolean isValidFlight(FlightEntity flight) {
        return flight != null
            && flight.cancelado == false
            && flight.origen != null
            && flight.destino != null
            && flight.origen.codigoOaci != null
            && flight.destino.codigoOaci != null;
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
}
