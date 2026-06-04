package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.FlightDayCancellationDto;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationEntity;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationRepository;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/db/flights")
@CrossOrigin(origins = "*")
public class FlightCancellationController {

    private final FlightDayCancellationRepository cancellationRepository;
    private final FlightRepository flightRepository;

    public FlightCancellationController(FlightDayCancellationRepository cancellationRepository, FlightRepository flightRepository) {
        this.cancellationRepository = cancellationRepository;
        this.flightRepository = flightRepository;
    }

    @PostMapping("/{id}/day-cancel")
    public ResponseEntity<?> cancelFlightDay(@PathVariable Long id, @RequestBody FlightDayCancellationDto dto) {
        if (!flightRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Vuelo no encontrado");
        }

        LocalDate date = LocalDate.parse(dto.fecha, DateTimeFormatter.ISO_LOCAL_DATE);

        if (cancellationRepository.existsByFlightIdAndFechaCancelacion(id, date)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("El vuelo ya está cancelado para ese día");
        }

        FlightDayCancellationEntity entity = new FlightDayCancellationEntity();
        entity.flightId = id;
        entity.fechaCancelacion = date;
        cancellationRepository.save(entity);

        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/day-cancel")
    public ResponseEntity<?> removeCancelFlightDay(@PathVariable Long id, @RequestParam String fecha) {
        LocalDate date = LocalDate.parse(fecha, DateTimeFormatter.ISO_LOCAL_DATE);
        Optional<FlightDayCancellationEntity> opt = cancellationRepository.findByFlightIdAndFechaCancelacion(id, date);
        
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Cancelación no encontrada");
        }

        cancellationRepository.delete(opt.get());
        return ResponseEntity.ok().build();
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
