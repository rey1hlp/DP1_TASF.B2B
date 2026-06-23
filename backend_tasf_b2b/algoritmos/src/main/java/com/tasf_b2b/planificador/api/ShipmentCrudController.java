package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.persistence.ShipmentStatus;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Objects;

@RestController
@RequestMapping("/api/db/shipments")
public class ShipmentCrudController {
    private static final Logger log = LoggerFactory.getLogger(ShipmentCrudController.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final Pattern PATRON_ORIGEN = Pattern.compile("_envios_([A-Za-z0-9]{4})_");

    private final ShipmentRepository repository;
    private final AirportRepository airportRepository;
    private final DailyPlanningService dailyPlanningService;
    private final JdbcTemplate jdbcTemplate;

    public ShipmentCrudController(
        ShipmentRepository repository,
        AirportRepository airportRepository,
        DailyPlanningService dailyPlanningService,
        JdbcTemplate jdbcTemplate
    ) {
        this.repository = repository;
        this.airportRepository = airportRepository;
        this.dailyPlanningService = dailyPlanningService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public ResponseEntity<Page<ShipmentCrudDto>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String query
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ShipmentEntity> result = (query == null || query.isBlank())
            ? repository.findAllByOrderByAuditDateInsDesc(pageable)
            : repository.searchOrderByAuditDateInsDesc(query.trim(), pageable);
        return ResponseEntity.ok(result.map(this::toDto));
    }

    @GetMapping("/daily")
    public ResponseEntity<List<ShipmentCrudDto>> getDailyShipments(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String airport) {

        String targetDate = (date != null && !date.isBlank()) ? date : 
                            LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

        StringBuilder sql = new StringBuilder(
            "SELECT s.id, s.codigo_pedido, ao.codigo_oaci as origen_oaci, ao.ciudad as origen_ciudad, " +
            "ad.codigo_oaci as destino_oaci, ad.ciudad as destino_ciudad, s.fecha, " +
            "s.hora_ingreso_utc, s.hora_ingreso_local, s.gmt_offset, s.cantidad, " +
            "s.id_cliente, s.sla_horas, s.status, s.audit_date_ins " +
            "FROM shipment s " +
            "JOIN airport ao ON s.origen_id = ao.id " +
            "JOIN airport ad ON s.destino_id = ad.id " +
            "WHERE s.fecha = ?"
        );

        List<Object> params = new ArrayList<>();
        params.add(targetDate);

        if (airport != null && !airport.isBlank()) {
            sql.append(" AND ao.codigo_oaci = ?");
            params.add(airport.toUpperCase(Locale.ROOT));
        }

        sql.append(" ORDER BY s.hora_ingreso_utc DESC");

        List<ShipmentCrudDto> shipments = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
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
            dto.status = com.tasf_b2b.planificador.persistence.ShipmentStatus.valueOf(rs.getString("status"));
            dto.auditDateIns = rs.getTimestamp("audit_date_ins").toLocalDateTime();
            return dto;
        }, params.toArray());

        return ResponseEntity.ok(shipments);
    }

    @PostMapping
    public ResponseEntity<ShipmentCrudDto> create(@RequestBody ShipmentCrudDto dto) {
        log.info(
            "[SHIPMENT_CRUD] create request pedido={} origen={} destino={} fecha={} ingresoLocal={} ingresoUtc={} gmtOffset={} cantidad={} cliente={} slaHoras={} status={}",
            dto != null ? dto.codigoPedido : null,
            dto != null ? dto.origen : null,
            dto != null ? dto.destino : null,
            dto != null ? dto.fecha : null,
            dto != null ? dto.ingresoLocal : null,
            dto != null ? dto.ingresoUtc : null,
            dto != null ? Integer.valueOf(dto.gmtOffset) : null,
            dto != null ? dto.cantidad : null,
            dto != null ? dto.idCliente : null,
            dto != null ? dto.slaHoras : null,
            dto != null ? dto.status : ShipmentStatus.PENDING
        );
        ShipmentEntity entity = new ShipmentEntity();
        if (!apply(entity, dto)) {
            log.warn("[SHIPMENT_CRUD] create rejected by validation");
            return ResponseEntity.badRequest().build();
        }
        ShipmentEntity saved = repository.save(entity);
        log.info(
            "[SHIPMENT_CRUD] create saved id={} pedido={} fecha={} ingresoLocal={} status={}",
            saved.id,
            saved.codigoPedido,
            saved.fecha,
            saved.ingresoLocal,
            saved.status
        );
        dailyPlanningService.replanNow("SHIPMENT_CREATE", "nuevo envio");
        return ResponseEntity.ok(toDto(saved));
    }

    @PostMapping("/import-txt")
    @Transactional
    public ResponseEntity<BulkImportResult> importTxt(@RequestParam("file") MultipartFile file) throws IOException {
        
        long startAll = System.currentTimeMillis();

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String originOaci = extractOrigin(file.getOriginalFilename());
        if (originOaci == null) {
            log.warn("[SHIPMENT_CRUD] import rejected because filename does not match standard");
            return ResponseEntity.badRequest().build();
        }

        AirportEntity originAirport = airportRepository.findByCodigoOaci(originOaci);
        if (originAirport == null) {
            log.warn("[SHIPMENT_CRUD] import rejected because origin airport does not exist origin={}", originOaci);
            return ResponseEntity.badRequest().build();
        }

        int total = 0;
        int inserted = 0;
        int updated = 0;
        int skipped = 0;
        List<String> invalidFormat = new ArrayList<>();
        List<String> invalidAirport = new ArrayList<>();
        
        final int BATCH_SIZE = 2000;
        List<Object[]> batch = new ArrayList<>(BATCH_SIZE);

        // Cargar aeropuertos en memoria
        List<AirportEntity> todosLosAeropuertos = airportRepository.findAll();
        java.util.Map<String, AirportEntity> mapaAeropuertos = new java.util.HashMap<>();
        for (AirportEntity ap : todosLosAeropuertos) {
            mapaAeropuertos.put(ap.codigoOaci.toUpperCase(Locale.ROOT), ap);
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                total++;

                String[] parts = trimmed.split("-", 7);
                if (parts.length < 7) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                String codigoPedido = parts[0].trim();
                String fecha = parts[1].trim();
                String hhTxt = parts[2].trim();
                String mmTxt = parts[3].trim();
                String destinoOaci = parts[4].trim().toUpperCase(Locale.ROOT);
                String cantidadTxt = parts[5].trim();
                String idCliente = parts[6].trim();

                if (codigoPedido.isBlank() || idCliente.isBlank()) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                AirportEntity destinoAirport = mapaAeropuertos.get(destinoOaci);
                if (destinoAirport == null) {
                    skipped++;
                    invalidAirport.add(line);
                    continue;
                }

                int hh, mm, cantidad;
                try {
                    hh = Integer.parseInt(hhTxt);
                    mm = Integer.parseInt(mmTxt);
                    cantidad = Integer.parseInt(cantidadTxt);
                } catch (NumberFormatException ex) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || cantidad < 0) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                LocalDate date;
                LocalTime localTime;
                try {
                    date = LocalDate.parse(fecha, DATE_FORMAT);
                    localTime = LocalTime.of(hh, mm);
                } catch (Exception ex) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                LocalDateTime ingresoLocal = LocalDateTime.of(date, localTime);
                LocalDateTime ingresoUtc = ingresoLocal.minusHours(originAirport.gmt);
                int slaHoras = computeSla(originAirport, destinoAirport);

                batch.add(new Object[]{
                    codigoPedido,
                    originAirport.id,
                    destinoAirport.id,
                    fecha,
                    ingresoUtc,
                    ingresoLocal,
                    originAirport.gmt,
                    cantidad,
                    idCliente,
                    slaHoras,
                    ShipmentStatus.PENDING.name()
                });

                if (batch.size() >= BATCH_SIZE) {
                    int[] results = executeShipmentBatch(batch);
                    for (int r : results) {
                        if (r == 1) inserted++;
                        else if (r == 2) updated++;
                    }
                    batch.clear();
                }
            }
        }

        // Procesar último lote
        if (!batch.isEmpty()) {
            int[] results = executeShipmentBatch(batch);
            for (int r : results) {
                if (r == 1) inserted++;
                else if (r == 2) updated++;
            }
        }

        if (inserted + updated > 0) {
            triggerReplanAsync("SHIPMENT_IMPORT", "txt masivo");
        }

        long elapsed = System.currentTimeMillis() - startAll;
        log.info("[SHIPMENT_CRUD] import finished file={} origin={} total={} inserted={} updated={} skipped={} time={}ms",
            file.getOriginalFilename(), originOaci, total, inserted, updated, skipped, elapsed);

        return ResponseEntity.ok(new BulkImportResult(total, inserted, updated, skipped, invalidFormat, invalidAirport));
    }

    // Cambiar void por int[]
    private int[] executeShipmentBatch(List<Object[]> batch) {
        String sql = 
            "INSERT INTO shipment " +
            "(codigo_pedido, origen_id, destino_id, fecha, hora_ingreso_utc, hora_ingreso_local, gmt_offset, cantidad, id_cliente, sla_horas, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
            "AS new ON DUPLICATE KEY UPDATE " +
            "origen_id = new.origen_id, " +
            "destino_id = new.destino_id, " +
            "fecha = new.fecha, " +
            "hora_ingreso_utc = new.hora_ingreso_utc, " +
            "hora_ingreso_local = new.hora_ingreso_local, " +
            "gmt_offset = new.gmt_offset, " +
            "cantidad = new.cantidad, " +
            "id_cliente = new.id_cliente, " +
            "sla_horas = new.sla_horas, " +
            "status = new.status";

        return jdbcTemplate.batchUpdate(sql, batch);
    }

    private void triggerReplanAsync(String triggerType, String detail) {
        CompletableFuture.runAsync(() -> {
            try {
                dailyPlanningService.replanNow(triggerType, detail);
            } catch (Exception ex) {
                log.error("[SHIPMENT_CRUD] async replanning failed triggerType={} detail={}", triggerType, detail, ex);
            }
        });
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShipmentCrudDto> update(@PathVariable Long id, @RequestBody ShipmentCrudDto payload) {
        log.info("[SHIPMENT_CRUD] update request id={} pedido={}", id, payload != null ? payload.codigoPedido : null);
        ShipmentEntity entity = repository.findById(id).orElse(null);
        if (entity == null) {
            log.warn("[SHIPMENT_CRUD] update rejected because shipment does not exist id={}", id);
            return ResponseEntity.notFound().build();
        }
        ShipmentCrudDto previous = toDto(entity);
        if (!apply(entity, payload)) {
            log.warn("[SHIPMENT_CRUD] update rejected by validation id={}", id);
            return ResponseEntity.badRequest().build();
        }
        ShipmentEntity saved = repository.save(entity);
        log.info(
            "[SHIPMENT_CRUD] update saved id={} pedido={} fecha={} ingresoLocal={} status={} requiresReplan={}",
            saved.id,
            saved.codigoPedido,
            saved.fecha,
            saved.ingresoLocal,
            saved.status,
            requiresReplan(previous, toDto(saved))
        );
        if (requiresReplan(previous, toDto(saved))) {
            dailyPlanningService.replanNow("SHIPMENT_UPDATE", "envio");
        }
        return ResponseEntity.ok(toDto(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            log.warn("[SHIPMENT_CRUD] delete rejected because shipment does not exist id={}", id);
            return ResponseEntity.notFound().build();
        }
        log.info("[SHIPMENT_CRUD] delete id={}", id);
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private boolean apply(ShipmentEntity target, ShipmentCrudDto source) {
        if (!isValid(source)) {
            return false;
        }
        AirportEntity origen = airportRepository.findByCodigoOaci(normalizeAirport(source.origen));
        AirportEntity destino = airportRepository.findByCodigoOaci(normalizeAirport(source.destino));
        if (origen == null || destino == null) {
            return false;
        }

        target.codigoPedido = source.codigoPedido.trim();
        target.origen = origen;
        target.destino = destino;
        target.fecha = normalizeFecha(source);
        target.ingresoUtc = source.ingresoUtc;
        target.ingresoLocal = source.ingresoLocal;
        target.gmtOffset = source.gmtOffset;
        target.cantidad = Math.max(0, source.cantidad);
        target.idCliente = source.idCliente.trim();
        target.slaHoras = source.slaHoras;
        target.status = source.status != null ? source.status : (target.status != null ? target.status : ShipmentStatus.PENDING);
        return true;
    }

    private ShipmentCrudDto toDto(ShipmentEntity entity) {
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

    private boolean isValid(ShipmentCrudDto dto) {
        return dto != null
            && dto.codigoPedido != null && !dto.codigoPedido.isBlank()
            && dto.origen != null && !dto.origen.isBlank()
            && dto.destino != null && !dto.destino.isBlank()
            && dto.ingresoUtc != null
            && dto.ingresoLocal != null
            && dto.idCliente != null && !dto.idCliente.isBlank();
    }

    private boolean requiresReplan(ShipmentCrudDto previous, ShipmentCrudDto current) {
        return !Objects.equals(previous.origen, current.origen)
            || !Objects.equals(previous.destino, current.destino)
            || !Objects.equals(previous.fecha, current.fecha)
            || !Objects.equals(previous.ingresoLocal, current.ingresoLocal)
            || previous.cantidad != current.cantidad
            || previous.slaHoras != current.slaHoras
            || previous.status != current.status;
    }

    private String normalizeAirport(String airportCode) {
        return airportCode == null ? null : airportCode.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeFecha(ShipmentCrudDto dto) {
        if (dto.fecha != null && !dto.fecha.isBlank()) {
            String digits = dto.fecha.trim().replace("-", "");
            if (digits.matches("\\d{8}")) {
                return digits;
            }
        }
        return dto.ingresoLocal.format(DATE_FORMAT);
    }

    private String extractOrigin(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }
        Matcher matcher = PATRON_ORIGEN.matcher(filename);
        if (!matcher.find()) {
            return null;
        }
        return matcher.group(1).toUpperCase(Locale.ROOT);
    }

    private int computeSla(AirportEntity origen, AirportEntity destino) {
        String origenContinente = origen != null && origen.continente != null && !origen.continente.isBlank()
            ? origen.continente.trim()
            : UtilArchivos.obtenerContinente(origen.codigoOaci);
        String destinoContinente = destino != null && destino.continente != null && !destino.continente.isBlank()
            ? destino.continente.trim()
            : UtilArchivos.obtenerContinente(destino.codigoOaci);
        return origenContinente.equalsIgnoreCase(destinoContinente) ? 24 : 48;
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
