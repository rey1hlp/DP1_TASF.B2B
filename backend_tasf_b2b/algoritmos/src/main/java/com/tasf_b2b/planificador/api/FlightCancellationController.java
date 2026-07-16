package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.FlightDayCancellationDto;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationEntity;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationRepository;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import com.tasf_b2b.planificador.sim.SimulationService;
import com.tasf_b2b.planificador.utils.OperationalTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/db/flights")
public class FlightCancellationController {
    private static final Logger log = LoggerFactory.getLogger(FlightCancellationController.class);
    private static final ZoneId ZONE = OperationalTime.resolveFallbackOperationalZone();

    private final FlightDayCancellationRepository cancellationRepository;
    private final FlightRepository flightRepository;
    private final DailyPlanningService dailyPlanningService;
    private final SimulationService simulationService;

    public FlightCancellationController(
        FlightDayCancellationRepository cancellationRepository,
        FlightRepository flightRepository,
        DailyPlanningService dailyPlanningService,
        SimulationService simulationService
    ) {
        this.cancellationRepository = cancellationRepository;
        this.flightRepository = flightRepository;
        this.dailyPlanningService = dailyPlanningService;
        this.simulationService = simulationService;
    }

    @PostMapping("/{id}/day-cancel")
    public ResponseEntity<?> cancelFlightDay(@PathVariable Long id, @RequestBody FlightDayCancellationDto dto) {
        log.info(
            "[FLIGHT_CANCEL] request cancel flightId={} fecha={} contextDate={} contextMinuteOfDay={}",
            id,
            dto != null ? dto.fecha : null,
            dto != null ? dto.contextDate : null,
            dto != null ? dto.contextMinuteOfDay : null
        );
        FlightEntity flight = flightRepository.findById(id).orElse(null);
        if (flight == null) {
            log.warn("[FLIGHT_CANCEL] cancel rejected because flight does not exist id={}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Vuelo no encontrado");
        }
        if (dto == null || dto.fecha == null || dto.fecha.isBlank()) {
            log.warn("[FLIGHT_CANCEL] cancel rejected because fecha is missing flightId={}", id);
            return ResponseEntity.badRequest().body("La fecha es obligatoria");
        }

        LocalDate requestedDate = LocalDate.parse(dto.fecha, DateTimeFormatter.ISO_LOCAL_DATE);
        LocalDate effectiveDate = resolveEffectiveCancellationDate(
            flight,
            requestedDate,
            dto.contextDate,
            dto.contextMinuteOfDay
        );

        if (cancellationRepository.existsByFlightIdAndFechaCancelacion(id, effectiveDate)) {
            log.warn("[FLIGHT_CANCEL] cancel rejected because it is already cancelled id={} fecha={}", id, effectiveDate);
            return ResponseEntity.status(HttpStatus.CONFLICT).body("El vuelo ya está cancelado para ese día");
        }

        FlightDayCancellationEntity entity = new FlightDayCancellationEntity();
        entity.flightId = id;
        entity.fechaCancelacion = effectiveDate;
        cancellationRepository.save(entity);
        boolean simulationContextUsed = hasSimulationContext(dto);
        log.info(
            "[FLIGHT_CANCEL] cancel saved flightId={} requestedDate={} effectiveDate={} cutoffMinute={} contextDate={} contextMinuteOfDay={} simulationContextUsed={}",
            id,
            requestedDate,
            effectiveDate,
	            departureLocalMinute(flight) - 60,
            dto.contextDate,
            dto.contextMinuteOfDay,
            simulationContextUsed
        );

        if (shouldReplan(effectiveDate, simulationContextUsed)) {
            log.info(
                "[FLIGHT_CANCEL] replan triggered flightId={} fecha={} simulationContextUsed={}",
                id,
                effectiveDate,
                simulationContextUsed
            );
            dailyPlanningService.replanNow("FLIGHT_CANCEL", "cancel day");
            simulationService.refreshActiveSimulations("FLIGHT_CANCEL", "flightId=" + id + " fecha=" + effectiveDate);
        } else {
            log.info(
                "[FLIGHT_CANCEL] replan skipped because cancellation is in the past flightId={} fecha={} simulationContextUsed={}",
                id,
                effectiveDate,
                simulationContextUsed
            );
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
        if (shouldReplan(date, false) && flight != null) {
            dailyPlanningService.replanNow("FLIGHT_CANCEL", "remove cancel");
            simulationService.refreshActiveSimulations("FLIGHT_CANCEL_REMOVE", "flightId=" + id + " fecha=" + date);
        }
        return ResponseEntity.ok().build();
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
            } catch (Exception ex) {
                log.warn("[FLIGHT_CANCEL] invalid simulation contextDate={} fallback to requestedDate={}", contextDate, requestedDate);
                baseDate = requestedDate;
            }
        }

        LocalTime referenceTime = null;
        boolean usingSimulationClock = false;
        if (contextMinuteOfDay != null && contextMinuteOfDay >= 0 && contextMinuteOfDay < 24 * 60) {
            referenceTime = LocalTime.of(contextMinuteOfDay / 60, contextMinuteOfDay % 60);
            usingSimulationClock = true;
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
        if (referenceMinute > cutoffMinute) {
            log.info(
                "[FLIGHT_CANCEL] effective date moved to next day by cutoff baseDate={} referenceTime={} cutoffMinute={} usingSimulationClock={}",
                baseDate,
                referenceTime,
                cutoffMinute,
                usingSimulationClock
            );
            return baseDate.plusDays(1);
        }
        return baseDate;
    }

    private boolean shouldReplan(LocalDate date, boolean forceReplan) {
        if (date == null) {
            return false;
        }

        if (forceReplan) {
            return true;
        }

        OffsetDateTime now = OffsetDateTime.now(ZONE);
        LocalDate today = now.toLocalDate();
        return !date.isBefore(today);
    }

    private boolean hasSimulationContext(FlightDayCancellationDto dto) {
        return dto != null
            && ((dto.contextDate != null && !dto.contextDate.isBlank())
            || dto.contextMinuteOfDay != null);
    }

    private int departureLocalMinute(FlightEntity flight) {
        int gmt = flight != null && flight.origen != null ? flight.origen.gmt : OperationalTime.DEFAULT_OPERATION_GMT;
        return Math.floorMod(flight.salidaUtcOffsetMin + (gmt * 60), 1440);
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
