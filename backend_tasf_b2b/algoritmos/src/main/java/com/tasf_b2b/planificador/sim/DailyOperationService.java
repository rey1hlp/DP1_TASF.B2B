package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;
import com.tasf_b2b.planificador.api.dto.DailyShipmentSummaryDto;
import com.tasf_b2b.planificador.api.dto.DailyWarehouseSnapshotDto;
import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.OperationAlertDto;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.persistence.ShipmentStatus;
import com.tasf_b2b.planificador.utils.OperationalTime;
import com.tasf_b2b.planificador.utils.UtilArchivos;

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
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class DailyOperationService {
    private static final Logger log = LoggerFactory.getLogger(DailyOperationService.class);
    private static final ZoneId ZONE = OperationalTime.resolveFallbackOperationalZone();
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final AirportRepository airportRepository;
    private final ShipmentRepository shipmentRepository;
    private final DailyPlanningService dailyPlanningService;
    private final Map<String, Boolean> observedInTransit = new ConcurrentHashMap<>();

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
        int dayIndex = UtilArchivos.obtenerDiaIndex(now.toLocalDate().format(DateTimeFormatter.BASIC_ISO_DATE));
        int currentMinute = dayIndex * 1440 + now.getHour() * 60 + now.getMinute() - (OperationalTime.DEFAULT_OPERATION_GMT * 60);
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

        List<ShipmentEntity> shipmentsForDate = shipmentRepository.findAll().stream()
            .filter(this::isValidShipment)
            .filter(shipment -> selectedDate == null || selectedDate.toString().replace("-", "").equals(shipmentLocalDateKey(shipment)))
            .collect(Collectors.toList());
        log.info("[DAILY_OP] shipments matched snapshot={}", shipmentsForDate.size());

        List<FlightSegmentDto> segments = dailyPlanningService.getCurrentPlanSegments().stream()
            .filter(segment -> airportFilter == null
                || airportFilter.equals(normalizeAirport(segment.origen))
                || airportFilter.equals(normalizeAirport(segment.destino)))
            .sorted(Comparator.comparingInt(segment -> segment.salidaMin))
            .collect(Collectors.toList());
        log.info("[DAILY_OP] segments matched snapshot={}", segments.size());

        Map<String, RespuestaRutaEnvioDto> routeByShipment = buildShipmentRouteCache(shipmentsForDate);

        syncShipmentStatuses(shipmentsForDate, currentMinute, routeByShipment);

        List<ShipmentEntity> shipments = shipmentsForDate.stream()
            .filter(shipment -> airportFilter == null
                || airportFilter.equals(shipmentOrigen(shipment))
                || airportFilter.equals(shipmentDestino(shipment)))
            .collect(Collectors.toList());

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
        snapshot.envios = shipments.stream()
            .map(shipment -> toShipmentDto(shipment, routeByShipment.get(shipment.codigoPedido)))
            .collect(Collectors.toList());
        return snapshot;
    }

    // 🌟 NUEVO MÉTODO CONECTADO PARA EL ESCENARIO 3 (Alertas Dinámicas de Colapso)
    public List<OperationAlertDto> getLiveOperationAlerts(String dateText) {
        LocalDate selectedDate = parseDate(dateText);
        
        // 1. Cargamos todos los aeropuertos activos
        Map<String, AirportEntity> airportEntities = airportRepository.findAll().stream()
            .filter(entity -> entity.codigoOaci != null && !entity.codigoOaci.isBlank())
            .collect(Collectors.toMap(
                entity -> entity.codigoOaci.trim().toUpperCase(Locale.ROOT),
                entity -> entity,
                (left, right) -> left,
                LinkedHashMap::new
            ));

        // 2. Filtramos los cargamentos por la fecha seleccionada usando tu misma lógica nativa
        List<ShipmentEntity> shipmentsForDate = shipmentRepository.findAll().stream()
            .filter(this::isValidShipment)
            .filter(shipment -> selectedDate == null || selectedDate.toString().replace("-", "").equals(shipmentLocalDateKey(shipment)))
            .collect(Collectors.toList());

        // 3. Calculamos la foto de ocupación de almacenes en base a esos cargamentos
        Map<String, DailyWarehouseSnapshotDto> warehouseSnapshot = buildWarehouseSnapshot(
            airportEntities,
            shipmentsForDate,
            null
        );

        // 4. Retornamos la lista de alertas reales calculadas automáticamente (>= 80% o >= 95%)
        return buildAlerts(warehouseSnapshot);
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
            if (shipment.status == ShipmentStatus.IN_TRANSIT || shipment.status == ShipmentStatus.DELIVERED) {
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
        long assigned  = shipments.stream()
            .filter(s -> s.status == ShipmentStatus.ASSIGNED)
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
        dto.assigned  = assigned;
        dto.inTransit = inTransit;
        dto.delivered = delivered;
        return dto;
    }

    private Map<String, RespuestaRutaEnvioDto> buildShipmentRouteCache(List<ShipmentEntity> shipments) {
        Map<String, RespuestaRutaEnvioDto> routeByShipment = new HashMap<>();
        if (shipments == null || shipments.isEmpty()) {
            return routeByShipment;
        }

        for (ShipmentEntity shipment : shipments) {
            if (shipment == null || shipment.codigoPedido == null || shipment.codigoPedido.isBlank()) {
                continue;
            }
            routeByShipment.put(shipment.codigoPedido, dailyPlanningService.getShipmentRoute(shipment.codigoPedido));
        }

        return routeByShipment;
    }

    private void syncShipmentStatuses(
        List<ShipmentEntity> shipments,
        int currentMinute,
        Map<String, RespuestaRutaEnvioDto> routeByShipment
    ) {
        if (shipments == null || shipments.isEmpty()) {
            return;
        }

        List<ShipmentEntity> changed = new ArrayList<>();
        for (ShipmentEntity shipment : shipments) {
            if (shipment == null || shipment.status == ShipmentStatus.CANCELLED) {
                continue;
            }
            RespuestaRutaEnvioDto route = routeByShipment.get(shipment.codigoPedido);
            if (route == null || route.ruta == null || route.ruta.isEmpty()) {
                log.debug("[DAILY_OP] shipment route missing code={} status={} currentMinute={}", shipment.codigoPedido, shipment.status, currentMinute);
                continue;
            }
            ShipmentStatus next = deriveStatus(shipment, route, currentMinute);
            if (next != null && next != shipment.status) {
                int firstSalida = route.ruta.stream().mapToInt(p -> p.salidaMin).min().orElse(-1);
                int lastLlegada = route.ruta.stream().mapToInt(p -> p.llegadaMin).max().orElse(-1);
                log.info(
                    "[DAILY_OP] shipment status change code={} from={} to={} currentMinute={} firstSalida={} lastLlegada={}",
                    shipment.codigoPedido,
                    shipment.status,
                    next,
                    currentMinute,
                    firstSalida,
                    lastLlegada
                );
                shipment.status = next;
                changed.add(shipment);
            }
        }

        if (!changed.isEmpty()) {
            shipmentRepository.saveAll(changed);
            log.info("[DAILY_OP] shipment statuses synchronized changed={}", changed.size());
        }
    }

    private ShipmentStatus deriveStatus(ShipmentEntity shipment, RespuestaRutaEnvioDto route, int currentMinute) {
        if (shipment == null) {
            return null;
        }
        if (shipment.status == ShipmentStatus.CANCELLED) {
            return ShipmentStatus.CANCELLED;
        }
        if (route == null || route.ruta == null || route.ruta.isEmpty()) {
            return shipment.status != null ? shipment.status : ShipmentStatus.PENDING;
        }

        int firstSalida = route.ruta.stream().mapToInt(p -> p.salidaMin).min().orElse(Integer.MAX_VALUE);
        int lastLlegada = route.ruta.stream().mapToInt(p -> p.llegadaMin).max().orElse(Integer.MIN_VALUE);

        if (currentMinute < firstSalida) {
            return ShipmentStatus.ASSIGNED;
        }
        boolean inAir = route.ruta.stream().anyMatch(p -> currentMinute >= p.salidaMin && currentMinute <= p.llegadaMin);
        if (inAir) {
            observedInTransit.put(shipment.codigoPedido, Boolean.TRUE);
            return ShipmentStatus.IN_TRANSIT;
        }
        if (currentMinute > lastLlegada) {
            boolean transitSeen = Boolean.TRUE.equals(observedInTransit.get(shipment.codigoPedido))
                || shipment.status == ShipmentStatus.IN_TRANSIT;
            if (transitSeen) {
                return ShipmentStatus.DELIVERED;
            }
            log.info(
                "[DAILY_OP] delivery deferred because transit was not observed code={} currentMinute={} lastLlegada={} status={}",
                shipment.codigoPedido,
                currentMinute,
                lastLlegada,
                shipment.status
            );
        }
        return ShipmentStatus.ASSIGNED;
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
            && shipment.ingresoUtc != null;
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

    private ShipmentCrudDto toShipmentDto(ShipmentEntity entity, RespuestaRutaEnvioDto route) {
        ShipmentCrudDto dto = new ShipmentCrudDto();
        dto.id = entity.id;
        dto.codigoPedido = entity.codigoPedido;
        dto.origen = entity.origen != null ? entity.origen.codigoOaci : null;
        dto.origenCiudad = entity.origen != null ? entity.origen.ciudad : null;
        dto.destino = entity.destino != null ? entity.destino.codigoOaci : null;
        dto.destinoCiudad = entity.destino != null ? entity.destino.ciudad : null;
        dto.ingresoUtc = entity.ingresoUtc;
        dto.origenGmt = entity.origen != null ? entity.origen.gmt : OperationalTime.DEFAULT_OPERATION_GMT;
        dto.ingresoLocal = OperationalTime.utcToLocal(entity.ingresoUtc, dto.origenGmt);
        dto.fecha = dto.ingresoLocal.format(DateTimeFormatter.BASIC_ISO_DATE);
        dto.cantidad = entity.cantidad;
        dto.idCliente = entity.idCliente;
        dto.slaHoras = entity.slaHoras;
        dto.status = entity.status;
        dto.auditDateIns = entity.auditDateIns;
        dto.vueloIds = route != null && route.ruta != null
            ? route.ruta.stream()
                .map(step -> String.valueOf(step.vueloId))
                .distinct()
                .toList()
            : List.of();
        return dto;
    }

    private String shipmentLocalDateKey(ShipmentEntity shipment) {
        if (shipment == null || shipment.ingresoUtc == null || shipment.origen == null) {
            return null;
        }
        return OperationalTime.dateKeyFromUtc(shipment.ingresoUtc, shipment.origen.gmt);
    }
}
