package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.SimulationVirtualCancellationDto;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import com.tasf_b2b.planificador.persistence.SimulationRunRepository;
import com.tasf_b2b.planificador.persistence.SimulationVirtualCancellationEntity;
import com.tasf_b2b.planificador.persistence.SimulationVirtualCancellationRepository;
import com.tasf_b2b.planificador.sim.SimulationService;
import com.tasf_b2b.planificador.utils.OperationalTime;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/simulations/{simId}")
public class SimulationVirtualCancellationController {
    private static final ZoneId ZONE = OperationalTime.resolveFallbackOperationalZone();

    private final SimulationVirtualCancellationRepository virtualCancellationRepository;
    private final SimulationRunRepository simulationRunRepository;
    private final FlightRepository flightRepository;
    private final SimulationService simulationService;

    public SimulationVirtualCancellationController(
        SimulationVirtualCancellationRepository virtualCancellationRepository,
        SimulationRunRepository simulationRunRepository,
        FlightRepository flightRepository,
        SimulationService simulationService
    ) {
        this.virtualCancellationRepository = virtualCancellationRepository;
        this.simulationRunRepository = simulationRunRepository;
        this.flightRepository = flightRepository;
        this.simulationService = simulationService;
    }

    @PostMapping("/flights/{flightId}/virtual-cancel")
    public ResponseEntity<?> cancelVirtualFlight(
        @PathVariable String simId,
        @PathVariable Long flightId,
        @RequestBody SimulationVirtualCancellationDto dto
    ) {
        if (simulationRunRepository.findBySimulationId(simId) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Simulación no encontrada");
        }
        FlightEntity flight = flightRepository.findById(flightId).orElse(null);
        if (flight == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Vuelo no encontrado");
        }
        if (dto == null || dto.fecha == null || dto.fecha.isBlank()) {
            return ResponseEntity.badRequest().body("La fecha es obligatoria");
        }

        LocalDate requestedDate = LocalDate.parse(dto.fecha, DateTimeFormatter.ISO_LOCAL_DATE);
        LocalDate effectiveDate = resolveEffectiveCancellationDate(
            flight,
            requestedDate,
            dto.contextDate,
            dto.contextMinuteOfDay
        );

        if (virtualCancellationRepository.existsBySimulationIdAndFlightIdAndFechaCancelacion(simId, flightId, effectiveDate)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("El vuelo ya está cancelado virtualmente para ese día");
        }

        SimulationVirtualCancellationEntity entity = new SimulationVirtualCancellationEntity();
        entity.simulationId = simId;
        entity.flightId = flightId;
        entity.fechaCancelacion = effectiveDate;
        entity.contextMinute = dto.contextMinuteOfDay;
        entity.reason = normalizeReason(dto.reason);
        SimulationVirtualCancellationEntity saved = virtualCancellationRepository.save(entity);

        simulationService.refreshSimulation(
            simId,
            "VIRTUAL_FLIGHT_CANCEL",
            "flightId=" + flightId + " fecha=" + effectiveDate
        );

        return ResponseEntity.ok(toDto(saved, flight));
    }

    @DeleteMapping("/flights/{flightId}/virtual-cancel")
    public ResponseEntity<?> removeVirtualCancel(
        @PathVariable String simId,
        @PathVariable Long flightId,
        @RequestParam String fecha
    ) {
        LocalDate date = LocalDate.parse(fecha, DateTimeFormatter.ISO_LOCAL_DATE);
        SimulationVirtualCancellationEntity entity = virtualCancellationRepository
            .findBySimulationIdAndFlightIdAndFechaCancelacion(simId, flightId, date)
            .orElse(null);
        if (entity == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Cancelación virtual no encontrada");
        }

        virtualCancellationRepository.delete(entity);
        simulationService.refreshSimulation(
            simId,
            "VIRTUAL_FLIGHT_CANCEL_REMOVE",
            "flightId=" + flightId + " fecha=" + date
        );
        return ResponseEntity.ok().build();
    }

    @GetMapping("/virtual-cancellations")
    public ResponseEntity<List<SimulationVirtualCancellationDto>> listVirtualCancellations(@PathVariable String simId) {
        List<SimulationVirtualCancellationEntity> entities =
            virtualCancellationRepository.findBySimulationIdOrderByFechaCancelacionAscFlightIdAsc(simId);
        java.util.Map<Long, FlightEntity> flights = flightRepository.findAllById(
            entities.stream().map(e -> e.flightId).filter(java.util.Objects::nonNull).toList()
        ).stream().collect(java.util.stream.Collectors.toMap(f -> f.id, f -> f));

        return ResponseEntity.ok(entities.stream()
            .map(entity -> toDto(entity, flights.get(entity.flightId)))
            .toList());
    }

    private LocalDate resolveEffectiveCancellationDate(
        FlightEntity flight,
        LocalDate requestedDate,
        String contextDate,
        Integer contextMinuteOfDay
    ) {
        if (flight == null || requestedDate == null) {
            return requestedDate;
        }

        LocalDate baseDate = requestedDate;
        if (contextDate != null && !contextDate.isBlank()) {
            try {
                baseDate = LocalDate.parse(contextDate, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ignored) {
                baseDate = requestedDate;
            }
        }

        LocalTime referenceTime;
        if (contextMinuteOfDay != null && contextMinuteOfDay >= 0 && contextMinuteOfDay < 24 * 60) {
            referenceTime = LocalTime.of(contextMinuteOfDay / 60, contextMinuteOfDay % 60);
        } else {
            OffsetDateTime now = OffsetDateTime.now(ZONE);
            LocalDate today = now.toLocalDate();
            if (!requestedDate.equals(today)) {
                return requestedDate;
            }
            referenceTime = now.toLocalTime();
        }

        int referenceMinute = referenceTime.getHour() * 60 + referenceTime.getMinute();
        int cutoffMinute = departureLocalMinute(flight) - 60;
        return referenceMinute > cutoffMinute ? baseDate.plusDays(1) : baseDate;
    }

    private SimulationVirtualCancellationDto toDto(
        SimulationVirtualCancellationEntity entity,
        FlightEntity flight
    ) {
        SimulationVirtualCancellationDto dto = new SimulationVirtualCancellationDto();
        dto.id = entity.id;
        dto.simulationId = entity.simulationId;
        dto.flightId = entity.flightId;
        dto.fechaCancelacion = entity.fechaCancelacion;
        dto.fecha = entity.fechaCancelacion != null ? entity.fechaCancelacion.format(DateTimeFormatter.ISO_LOCAL_DATE) : null;
        dto.contextMinute = entity.contextMinute;
        dto.contextMinuteOfDay = entity.contextMinute;
        dto.reason = entity.reason;
        dto.createdAt = entity.createdAt;
        if (flight != null) {
            dto.flightCodigo = flight.codigo;
            dto.origen = flight.origen != null ? flight.origen.codigoOaci : null;
            dto.destino = flight.destino != null ? flight.destino.codigoOaci : null;
        }
        return dto;
    }

    private String normalizeReason(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > 160 ? trimmed.substring(0, 160) : trimmed;
    }

    private int departureLocalMinute(FlightEntity flight) {
        int gmt = flight != null && flight.origen != null ? flight.origen.gmt : OperationalTime.DEFAULT_OPERATION_GMT;
        return Math.floorMod(flight.salidaUtcOffsetMin + (gmt * 60), 1440);
    }
}
