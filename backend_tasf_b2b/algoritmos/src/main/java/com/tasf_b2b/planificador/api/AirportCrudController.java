package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.AirportCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/db/airports")
public class AirportCrudController {
    private final AirportRepository repository;
    private final JdbcTemplate jdbcTemplate;
    private static final int BATCH_SIZE = 500;

    public AirportCrudController(AirportRepository repository, JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<Page<AirportCrudDto>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String query
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AirportEntity> result = (query == null || query.isBlank())
            ? repository.findAllByOrderByAuditDateInsDesc(pageable)
            : repository.findByCodigoOaciContainingIgnoreCaseOrNombreContainingIgnoreCaseOrderByAuditDateInsDesc(query, query, pageable);
        return ResponseEntity.ok(result.map(this::toDto));
    }

    @PostMapping
    public ResponseEntity<AirportCrudDto> create(@RequestBody AirportCrudDto dto) {
        AirportEntity entity = new AirportEntity();
        apply(entity, dto);
        return ResponseEntity.ok(toDto(repository.save(entity)));
    }

    @PostMapping("/import-csv")
    public ResponseEntity<BulkImportResult> importCsv(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        int total = 0;
        int inserted = 0;
        int updated = 0;
        int skipped = 0;
        List<String> invalidFormat = new ArrayList<>();
        List<Object[]> batch = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)
        )) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return ResponseEntity.badRequest().build();
            }
            List<String> headers = parseCsvLine(headerLine);
            Map<String, Integer> index = new HashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                index.put(headers.get(i).trim().toLowerCase(), i);
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                total++;
                List<String> cols = parseCsvLine(line);

                String codigo = getCsvValue(index, cols, "codigo_oaci");
                String nombre = getCsvValue(index, cols, "nombre");
                String pais = getCsvValue(index, cols, "pais");
                String ciudad = getCsvValue(index, cols, "ciudad");
                String continente = getCsvValue(index, cols, "continente");
                Integer gmt = parseInt(getCsvValue(index, cols, "gmt"));
                Integer capacidad = parseInt(getCsvValue(index, cols, "capacidad"));
                Double latitud = parseDouble(getCsvValue(index, cols, "latitud"));
                Double longitud = parseDouble(getCsvValue(index, cols, "longitud"));

                if (codigo == null || codigo.isBlank() || nombre == null || nombre.isBlank() || pais == null || pais.isBlank()) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }
                if (gmt == null || capacidad == null || latitud == null || longitud == null) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                String codigoOaci = codigo.trim().toUpperCase();
                String ciudadValue = (ciudad == null || ciudad.isBlank()) ? nombre.trim() : ciudad.trim();
                String continenteValue = (continente == null || continente.isBlank()) ? null : continente.trim();

                batch.add(new Object[] {
                    codigoOaci,
                    nombre.trim(),
                    pais.trim(),
                    ciudadValue,
                    continenteValue,
                    gmt,
                    capacidad,
                    latitud,
                    longitud
                });

                if (batch.size() >= BATCH_SIZE) {
                    int[] results = executeAirportBatch(batch);
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
            int[] results = executeAirportBatch(batch);
            for (int count : results) {
                if (count == 1) {
                    inserted++;
                } else if (count > 1) {
                    updated++;
                }
            }
        }

        return ResponseEntity.ok(new BulkImportResult(total, inserted, updated, skipped, invalidFormat, List.of()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AirportCrudDto> update(@PathVariable Long id, @RequestBody AirportCrudDto dto) {
        AirportEntity entity = repository.findById(id).orElse(null);
        if (entity == null) {
            return ResponseEntity.notFound().build();
        }
        apply(entity, dto);
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

    private void apply(AirportEntity entity, AirportCrudDto dto) {
        entity.codigoOaci = dto.codigoOaci;
        entity.nombre = dto.nombre;
        entity.pais = dto.pais;
        entity.ciudad = dto.ciudad;
        entity.continente = dto.continente;
        entity.gmt = dto.gmt;
        entity.capacidad = dto.capacidad;
        entity.latitud = dto.latitud;
        entity.longitud = dto.longitud;
    }

    private AirportCrudDto toDto(AirportEntity entity) {
        AirportCrudDto dto = new AirportCrudDto();
        dto.id = entity.id;
        dto.codigoOaci = entity.codigoOaci;
        dto.nombre = entity.nombre;
        dto.pais = entity.pais;
        dto.ciudad = entity.ciudad;
        dto.continente = entity.continente;
        dto.gmt = entity.gmt;
        dto.capacidad = entity.capacidad;
        dto.latitud = entity.latitud;
        dto.longitud = entity.longitud;
        return dto;
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                inQuotes = !inQuotes;
                continue;
            }
            if (ch == ',' && !inQuotes) {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        values.add(current.toString());
        return values;
    }

    private String getCsvValue(Map<String, Integer> index, List<String> cols, String key) {
        Integer idx = index.get(key);
        if (idx == null || idx < 0 || idx >= cols.size()) {
            return null;
        }
        return cols.get(idx).trim();
    }

    private Integer parseInt(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim().replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private int[] executeAirportBatch(List<Object[]> batch) {
        String sql =
            "INSERT INTO airport " +
            "(codigo_oaci, nombre, pais, ciudad, continente, gmt, capacidad, latitud, longitud) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
            "AS new " +
            "ON DUPLICATE KEY UPDATE " +
            "nombre = new.nombre, " +
            "pais = new.pais, " +
            "ciudad = new.ciudad, " +
            "continente = new.continente, " +
            "gmt = new.gmt, " +
            "capacidad = new.capacidad, " +
            "latitud = new.latitud, " +
            "longitud = new.longitud";

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
