package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.FlightDayCancellationDto;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationEntity;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationRepository;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/db/flights")
@CrossOrigin(origins = "*")
public class FlightCancellationController {
    private static final Logger log = LoggerFactory.getLogger(FlightCancellationController.class);
    private static final ZoneId ZONE = ZoneId.of("America/Lima");

    private final FlightDayCancellationRepository cancellationRepository;
    private final FlightRepository flightRepository;
    private final DailyPlanningService dailyPlanningService;

    public FlightCancellationController(
        FlightDayCancellationRepository cancellationRepository,
        FlightRepository flightRepository,
        DailyPlanningService dailyPlanningService
    ) {
        this.cancellationRepository = cancellationRepository;
        this.flightRepository = flightRepository;
        this.dailyPlanningService = dailyPlanningService;
    }

    @PostMapping("/{id}/day-cancel")
    public ResponseEntity<?> cancelFlightDay(@PathVariable Long id, @RequestBody FlightDayCancellationDto dto) {
        log.info("[FLIGHT_CANCEL] request cancel flightId={} fecha={}", id, dto != null ? dto.fecha : null);
        FlightEntity flight = flightRepository.findById(id).orElse(null);
        if (flight == null) {
            log.warn("[FLIGHT_CANCEL] cancel rejected because flight does not exist id={}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Vuelo no encontrado");
        }

        LocalDate date = LocalDate.parse(dto.fecha, DateTimeFormatter.ISO_LOCAL_DATE);

        if (cancellationRepository.existsByFlightIdAndFechaCancelacion(id, date)) {
            log.warn("[FLIGHT_CANCEL] cancel rejected because it is already cancelled id={} fecha={}", id, dto.fecha);
            return ResponseEntity.status(HttpStatus.CONFLICT).body("El vuelo ya está cancelado para ese día");
        }

        FlightDayCancellationEntity entity = new FlightDayCancellationEntity();
        entity.flightId = id;
        entity.fechaCancelacion = date;
        cancellationRepository.save(entity);
        log.info("[FLIGHT_CANCEL] cancel saved flightId={} fecha={}", id, dto.fecha);
        if (shouldReplan(flight, date)) {
            log.info("[FLIGHT_CANCEL] replan triggered flightId={} fecha={}", id, dto.fecha);
            dailyPlanningService.replanNow("FLIGHT_CANCEL", "cancel day");
        } else {
            log.info("[FLIGHT_CANCEL] replan skipped because flight already departed flightId={} fecha={}", id, dto.fecha);
        }

        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/day-cancel")
    public ResponseEntity<?> removeCancelFlightDay(@PathVariable Long id, @RequestParam String fecha) {
        log.info("[FLIGHT_CANCEL] request remove cancel flightId={} fecha={}", id, fecha);
        FlightEntity flight = flightRepository.findById(id).orElse(null);
        LocalDate date = LocalDate.parse(fecha, DateTimeFormatter.ISO_LOCAL_DATE);
        Optional<FlightDayCancellationEntity> opt = cancellationRepository.findByFlightIdAndFechaCancelacion(id, date);
        
        if (opt.isEmpty()) {
            log.warn("[FLIGHT_CANCEL] remove rejected because cancellation does not exist flightId={} fecha={}", id, fecha);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Cancelación no encontrada");
        }

        cancellationRepository.delete(opt.get());
        log.info("[FLIGHT_CANCEL] cancellation removed flightId={} fecha={}", id, fecha);
        if (shouldReplan(flight, date)) {
            dailyPlanningService.replanNow("FLIGHT_CANCEL", "remove cancel");
        }
        return ResponseEntity.ok().build();
    }

    private boolean shouldReplan(FlightEntity flight, LocalDate date) {
        if (flight == null || flight.salida == null) {
            return false;
        }

        OffsetDateTime now = OffsetDateTime.now(ZONE);
        LocalDate today = now.toLocalDate();
        LocalDateTime salida = flight.salida;

        if (date.isAfter(today)) {
            return true;
        }
        if (date.isBefore(today)) {
            return false;
        }
        return !now.toLocalTime().isAfter(salida.toLocalTime());
    }

    @GetMapping("/{id}/day-cancels")
    public ResponseEntity<List<String>> getCancelledDays(@PathVariable Long id) {
        List<FlightDayCancellationEntity> cancellations = cancellationRepository.findByFlightId(id);
        List<String> dates = cancellations.stream()
            .map(c -> c.fechaCancelacion.format(DateTimeFormatter.ISO_LOCAL_DATE))
            .collect(Collectors.toList());
        return ResponseEntity.ok(dates);
    }
}
