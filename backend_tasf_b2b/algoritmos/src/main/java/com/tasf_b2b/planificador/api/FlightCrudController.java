package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.FlightCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/db/flights")
public class FlightCrudController {
    private final FlightRepository repository;
    private final AirportRepository airportRepository;
    private final JdbcTemplate jdbcTemplate;
    private static final int BATCH_SIZE = 1000;

    public FlightCrudController(
        FlightRepository repository,
        AirportRepository airportRepository,
        JdbcTemplate jdbcTemplate
    ) {
        this.repository = repository;
        this.airportRepository = airportRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<Page<FlightCrudDto>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String query
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<FlightEntity> result = (query == null || query.isBlank())
            ? repository.findAllByOrderByAuditDateInsDesc(pageable)
            : repository.findByCodigoContainingIgnoreCaseOrOrigen_CodigoOaciContainingIgnoreCaseOrDestino_CodigoOaciContainingIgnoreCaseOrderByAuditDateInsDesc(query, query, query, pageable);
        return ResponseEntity.ok(result.map(this::toDto));
    }

    @PostMapping
    public ResponseEntity<FlightCrudDto> create(@RequestBody FlightCrudDto dto) {
        FlightEntity entity = new FlightEntity();
        if (!apply(entity, dto)) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(toDto(repository.save(entity)));
    }

    @PostMapping("/import-txt")
    public ResponseEntity<BulkImportResult> importTxt(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        // Cachear todos los aeropuertos en memoria para evitar queries repetidas
        java.util.List<AirportEntity> allAirports = airportRepository.findAll();
        java.util.Map<String, AirportEntity> airportCache = new java.util.HashMap<>();
        for (AirportEntity airport : allAirports) {
            airportCache.put(airport.codigoOaci, airport);
        }

        int total = 0;
        int inserted = 0;
        int updated = 0;
        int skipped = 0;
        List<String> invalidFormat = new ArrayList<>();
        List<String> invalidAirport = new ArrayList<>();
        List<Object[]> batch = new ArrayList<>();

        DateTimeFormatter timeFormat = DateTimeFormatter.ofPattern("HH:mm");
        LocalDate baseDate = LocalDate.now();

        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)
        )) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                total++;
                String[] parts = trimmed.split("-");
                if (parts.length < 5) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                String origenOaci = parts[0].trim().toUpperCase();
                String destinoOaci = parts[1].trim().toUpperCase();
                String salidaTxt = parts[2].trim();
                String llegadaTxt = parts[3].trim();
                String capacidadTxt = parts[4].trim();

                AirportEntity origen = airportCache.get(origenOaci);
                AirportEntity destino = airportCache.get(destinoOaci);
                if (origen == null || destino == null) {
                    skipped++;
                    invalidAirport.add(line);
                    continue;
                }

                int capacidad;
                try {
                    capacidad = Integer.parseInt(capacidadTxt);
                } catch (NumberFormatException ex) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                LocalTime salidaTime;
                LocalTime llegadaTime;
                try {
                    salidaTime = LocalTime.parse(salidaTxt, timeFormat);
                    llegadaTime = LocalTime.parse(llegadaTxt, timeFormat);
                } catch (Exception ex) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                LocalDate llegadaDate = llegadaTime.isBefore(salidaTime) ? baseDate.plusDays(1) : baseDate;
                LocalDateTime salida = LocalDateTime.of(baseDate, salidaTime);
                LocalDateTime llegada = LocalDateTime.of(llegadaDate, llegadaTime);

                String codigoBase = String.format(
                    "%s%s-%s-%s",
                    origenOaci,
                    destinoOaci,
                    salidaTxt.replace(":", ""),
                    llegadaTxt.replace(":", "")
                );
                String codigo = codigoBase.length() > 20 ? codigoBase.substring(0, 20) : codigoBase;

                batch.add(new Object[] {
                    codigo,
                    origen.id,
                    destino.id,
                    salida,
                    llegada,
                    capacidad,
                    false
                });

                if (batch.size() >= BATCH_SIZE) {
                    int[] results = executeFlightBatch(batch);
                    for (int count : results) {
                        if (count == 1) {
                            inserted++;
                        } else if (count > 1) {
                            updated++;
                        }
                    }
                    batch.clear();
                }
            }
        }

        if (!batch.isEmpty()) {
            int[] results = executeFlightBatch(batch);
            for (int count : results) {
                if (count == 1) {
                    inserted++;
                } else if (count > 1) {
                    updated++;
                }
            }
        }

        return ResponseEntity.ok(new BulkImportResult(total, inserted, updated, skipped, invalidFormat, invalidAirport));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FlightCrudDto> update(@PathVariable Long id, @RequestBody FlightCrudDto dto) {
        FlightEntity entity = repository.findById(id).orElse(null);
        if (entity == null) {
            return ResponseEntity.notFound().build();
        }
        if (!apply(entity, dto)) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(toDto(repository.save(entity)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAll(@RequestParam(defaultValue = "false") boolean resetIds) {
        jdbcTemplate.execute("DELETE FROM flight");
        if (resetIds) {
            jdbcTemplate.execute("ALTER TABLE flight AUTO_INCREMENT = 1");
        }
        return ResponseEntity.noContent().build();
    }

    private boolean apply(FlightEntity entity, FlightCrudDto dto) {
        AirportEntity origen = airportRepository.findByCodigoOaci(dto.origenOaci);
        AirportEntity destino = airportRepository.findByCodigoOaci(dto.destinoOaci);
        if (origen == null || destino == null) {
            return false;
        }
        entity.codigo = dto.codigo;
        entity.origen = origen;
        entity.destino = destino;
        try {
            entity.salida = LocalDateTime.parse(dto.salida);
            entity.llegada = LocalDateTime.parse(dto.llegada);
        } catch (Exception ex) {
            return false;
        }
        entity.capacidad = dto.capacidad;
        entity.cancelado = dto.cancelado;
        return true;
    }

    private FlightCrudDto toDto(FlightEntity entity) {
        FlightCrudDto dto = new FlightCrudDto();
        dto.id = entity.id;
        dto.codigo = entity.codigo;
        dto.origenOaci = entity.origen.codigoOaci;
        dto.origenCiudad = entity.origen.ciudad;
        dto.destinoOaci = entity.destino.codigoOaci;
        dto.destinoCiudad = entity.destino.ciudad;
        dto.salida = entity.salida.toString();
        dto.llegada = entity.llegada.toString();
        dto.capacidad = entity.capacidad;
        dto.cancelado = entity.cancelado;
        return dto;
    }

    private int[] executeFlightBatch(List<Object[]> batch) {
        String sql =
            "INSERT INTO flight " +
            "(codigo, origen_id, destino_id, salida, llegada, capacidad, cancelado) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?) " +
            "AS new " +
            "ON DUPLICATE KEY UPDATE " +
            "origen_id = new.origen_id, " +
            "destino_id = new.destino_id, " +
            "salida = new.salida, " +
            "llegada = new.llegada, " +
            "capacidad = new.capacidad, " +
            "cancelado = new.cancelado";

        return jdbcTemplate.batchUpdate(sql, batch);
    }

    public record BulkImportResult(
        int total,
        int inserted,
        int updated,
        int skipped,
        List<String> invalidFormatLines,
        List<String> invalidAirportLines
    ) {}
}
