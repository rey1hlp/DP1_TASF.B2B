package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.FlightCrudDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/db/flights")
public class FlightCrudController {
    private final FlightRepository repository;
    private final AirportRepository airportRepository;
    private final JdbcTemplate jdbcTemplate;
    private static final int BATCH_SIZE = 2000; // Aumentado de 500 a 2000

    public FlightCrudController(
        FlightRepository repository,
        AirportRepository airportRepository,
        JdbcTemplate jdbcTemplate
    ) {
        this.repository = repository;
        this.airportRepository = airportRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    // ==================== ENDPOINTS EXISTENTES (sin cambios) ====================
    @GetMapping("/{id}")
    public ResponseEntity<FlightCrudDto> getFlightById(@PathVariable Long id) {
        return repository.findById(id)
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/shipments")
    public ResponseEntity<List<ShipmentCrudDto>> getShipmentsByFlightRoute(@PathVariable Long id) {
        FlightEntity flight = repository.findById(id).orElse(null);
        if (flight == null) {
            return ResponseEntity.notFound().build();
        }

        String fechaVuelo = flight.salida.toLocalDate().toString().replace("-", "");

        String sql = "SELECT s.id, s.codigo_pedido, ao.codigo_oaci as origen_oaci, ao.ciudad as origen_ciudad, " +
                    "ad.codigo_oaci as destino_oaci, ad.ciudad as destino_ciudad, s.fecha, " +
                    "s.hora_ingreso_utc, s.hora_ingreso_local, s.gmt_offset, s.cantidad, " +
                    "s.id_cliente, s.sla_horas, s.asignado, s.audit_date_ins " +
                    "FROM shipment s " +
                    "JOIN airport ao ON s.origen_id = ao.id " +
                    "JOIN airport ad ON s.destino_id = ad.id " +
                    "WHERE s.origen_id = ? AND s.destino_id = ? AND s.fecha = ?";

        List<ShipmentCrudDto> shipments = jdbcTemplate.query(sql, (rs, rowNum) -> {
            ShipmentCrudDto dto = new ShipmentCrudDto();
            dto.id = rs.getLong("id");
            dto.codigoPedido = rs.getString("codigo_pedido");
            dto.origen = rs.getString("origen_oaci");
            dto.origenCiudad = rs.getString("origen_ciudad");
            dto.destino = rs.getString("destino_oaci");
            dto.destinoCiudad = rs.getString("destino_ciudad");
            dto.fecha = rs.getString("fecha");
            dto.ingresoUtc = rs.getTimestamp("hora_ingreso_utc").toLocalDateTime();
            dto.ingresoLocal = rs.getTimestamp("hora_ingreso_local").toLocalDateTime();
            dto.gmtOffset = rs.getInt("gmt_offset");
            dto.cantidad = rs.getInt("cantidad");
            dto.idCliente = rs.getString("id_cliente");
            dto.slaHoras = rs.getInt("sla_horas");
            dto.asignado = rs.getBoolean("asignado");
            dto.auditDateIns = rs.getTimestamp("audit_date_ins").toLocalDateTime();
            return dto;
        }, flight.origen.id, flight.destino.id, fechaVuelo);

        return ResponseEntity.ok(shipments);
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

    // ==================== ENDPOINT OPTIMIZADO ====================
    @PostMapping("/import-txt")
    @Transactional  // ← CLAVE: toda la operación en una sola transacción
    public ResponseEntity<BulkImportResult> importTxt(@RequestParam("file") MultipartFile file) throws IOException {
        long startAll = System.currentTimeMillis();
        
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        int total = 0;
        int inserted = 0;
        int updated = 0;
        int skipped = 0;
        List<String> invalidFormat = new ArrayList<>();
        List<String> invalidAirport = new ArrayList<>();
        List<Object[]> batch = new ArrayList<>(BATCH_SIZE);

        DateTimeFormatter timeFormat = DateTimeFormatter.ofPattern("HH:mm");
        LocalDate baseDate = LocalDate.now();

        // Carga de aeropuertos en memoria (una sola consulta)
        long t1 = System.currentTimeMillis();
        Map<String, AirportEntity> mapaAeropuertos = new HashMap<>();
        for (AirportEntity ap : airportRepository.findAll()) {
            mapaAeropuertos.put(ap.codigoOaci.toUpperCase(), ap);
        }
        long t2 = System.currentTimeMillis();
        System.out.println("Tiempo carga aeropuertos: " + (t2 - t1) + " ms");

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                
                total++;
                String[] parts = trimmed.split("-", 5);
                
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

                AirportEntity origen = mapaAeropuertos.get(origenOaci);
                AirportEntity destino = mapaAeropuertos.get(destinoOaci);
                
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

                LocalDate llegadaDate = llegadaTime.isBefore(salidaTime) 
                        ? baseDate.plusDays(1) 
                        : baseDate;
                LocalDateTime salida = LocalDateTime.of(baseDate, salidaTime);
                LocalDateTime llegada = LocalDateTime.of(llegadaDate, llegadaTime);

                String codigo = generarCodigo(origenOaci, destinoOaci, salidaTxt, llegadaTxt);

                batch.add(new Object[]{
                        codigo, origen.id, destino.id, salida, llegada, capacidad, false
                });

                // Si alcanzamos el tamaño del lote, ejecutamos el batch
                if (batch.size() >= BATCH_SIZE) {
                    int[] results = executeFlightBatchOptimized(batch);
                    inserted += countInserts(results);
                    updated += countUpdates(results);
                    batch.clear();
                }
            }
        }

        // Ejecutar el resto de registros
        if (!batch.isEmpty()) {
            int[] results = executeFlightBatchOptimized(batch);
            inserted += countInserts(results);
            updated += countUpdates(results);
        }

        long elapsed = System.currentTimeMillis() - startAll;
        System.out.println("Importación completada en " + elapsed + " ms");
        System.out.println("Totales - Insertados: " + inserted + ", Actualizados: " + updated + ", Saltados: " + skipped);

        return ResponseEntity.ok(new BulkImportResult(total, inserted, updated, skipped, invalidFormat, invalidAirport));
    }

    // ==================== MÉTODOS PRIVADOS ====================
    private int[] executeFlightBatchOptimized(List<Object[]> batch) {
        String sql = """
            INSERT INTO flight (codigo, origen_id, destino_id, salida, llegada, capacidad, cancelado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                origen_id = VALUES(origen_id),
                destino_id = VALUES(destino_id),
                salida = VALUES(salida),
                llegada = VALUES(llegada),
                capacidad = VALUES(capacidad),
                cancelado = VALUES(cancelado)
            """;
        return jdbcTemplate.batchUpdate(sql, batch);
    }

    private int countInserts(int[] results) {
        int count = 0;
        for (int r : results) {
            if (r == 1) count++;  // 1 = fila insertada
        }
        return count;
    }

    private int countUpdates(int[] results) {
        int count = 0;
        for (int r : results) {
            if (r == 2) count++;  // 2 = fila actualizada (MySQL)
            // En algunos drivers, update devuelve 1, pero con ON DUPLICATE KEY UPDATE
            // MySQL devuelve 2 si afecta a una fila existente.
        }
        return count;
    }

    private String generarCodigo(String origen, String destino, String salida, String llegada) {
        String codigoBase = String.format("%s%s-%s-%s",
                origen, destino,
                salida.replace(":", ""),
                llegada.replace(":", "")
        );
        return codigoBase.length() > 20 ? codigoBase.substring(0, 20) : codigoBase;
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

    public record BulkImportResult(
        int total,
        int inserted,
        int updated,
        int skipped,
        List<String> invalidFormatLines,
        List<String> invalidAirportLines
    ) {}
}
