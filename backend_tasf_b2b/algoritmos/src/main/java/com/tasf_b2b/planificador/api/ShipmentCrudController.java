package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.auth.AuthenticatedUser;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.persistence.ShipmentStatus;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import com.tasf_b2b.planificador.utils.OperationalTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
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
    private static final Object SHIPMENT_CODE_LOCK = new Object();
    private static final int NUMERIC_SHIPMENT_CODE_LENGTH = 9;
    private static final int CREATE_CODE_RETRY_LIMIT = 4;

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
        @RequestParam(required = false) String query,
        Authentication authentication
    ) {
        Pageable pageable = PageRequest.of(page, size);
        AuthenticatedUser user = authenticatedUser(authentication);
        String airport = userAirportCode(user);
        Page<ShipmentEntity> result;
        if (airport != null) {
            result = (query == null || query.isBlank())
                ? repository.findVisibleForAirport(airport, pageable)
                : repository.searchVisibleForAirport(airport, query.trim(), pageable);
        } else {
            result = (query == null || query.isBlank())
                ? repository.findAllByOrderByAuditDateInsDesc(pageable)
                : repository.searchOrderByAuditDateInsDesc(query.trim(), pageable);
        }
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
            "ad.codigo_oaci as destino_oaci, ad.ciudad as destino_ciudad, ao.gmt as origen_gmt, " +
            "s.ingreso_utc, s.cantidad, " +
            "s.id_cliente, s.sla_horas, s.status, s.audit_date_ins " +
            "FROM shipment s " +
            "JOIN airport ao ON s.origen_id = ao.id " +
            "JOIN airport ad ON s.destino_id = ad.id " +
            "WHERE DATE_FORMAT(DATE_ADD(s.ingreso_utc, INTERVAL ao.gmt HOUR), '%Y%m%d') = ?"
        );

        List<Object> params = new ArrayList<>();
        params.add(targetDate);

        if (airport != null && !airport.isBlank()) {
            sql.append(" AND ao.codigo_oaci = ?");
            params.add(airport.toUpperCase(Locale.ROOT));
        }

        sql.append(" ORDER BY s.ingreso_utc DESC");

        List<ShipmentCrudDto> shipments = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            ShipmentCrudDto dto = new ShipmentCrudDto();
            dto.id = rs.getLong("id");
            dto.codigoPedido = rs.getString("codigo_pedido");
            dto.origen = rs.getString("origen_oaci");
            dto.origenCiudad = rs.getString("origen_ciudad");
            dto.destino = rs.getString("destino_oaci");
            dto.destinoCiudad = rs.getString("destino_ciudad");
            dto.ingresoUtc = rs.getTimestamp("ingreso_utc").toLocalDateTime();
            dto.origenGmt = rs.getInt("origen_gmt");
            dto.ingresoLocal = OperationalTime.utcToLocal(dto.ingresoUtc, dto.origenGmt);
            dto.fecha = dto.ingresoLocal.format(DATE_FORMAT);
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
    public ResponseEntity<ShipmentCrudDto> create(@RequestBody ShipmentCrudDto dto, Authentication authentication) {
        log.info(
            "[SHIPMENT_CRUD] create request pedido={} origen={} destino={} ingresoLocal={} cantidad={} cliente={} slaHoras={} status={}",
            dto != null ? dto.codigoPedido : null,
            dto != null ? dto.origen : null,
            dto != null ? dto.destino : null,
            dto != null ? dto.ingresoLocal : null,
            dto != null ? dto.cantidad : null,
            dto != null ? dto.idCliente : null,
            dto != null ? dto.slaHoras : null,
            dto != null ? dto.status : ShipmentStatus.PENDING
        );
        ShipmentEntity entity = new ShipmentEntity();
        if (!apply(entity, dto, authenticatedUser(authentication))) {
            log.warn("[SHIPMENT_CRUD] create rejected by validation");
            return ResponseEntity.badRequest().build();
        }
        String requestedCode = entity.codigoPedido;
        ShipmentEntity saved = saveNewShipmentWithResolvedCode(entity, requestedCode);
        log.info(
            "[SHIPMENT_CRUD] create saved id={} pedido={} requested={} reassigned={} ingresoUtc={} status={}",
            saved.id,
            saved.codigoPedido,
            requestedCode,
            !Objects.equals(saved.codigoPedido, requestedCode),
            saved.ingresoUtc,
            saved.status
        );
        dailyPlanningService.replanNow("SHIPMENT_CREATE", "nuevo envio");
        ShipmentCrudDto response = toDto(saved);
        response.codigoPedidoSolicitado = requestedCode;
        response.codigoPedidoReasignado = !Objects.equals(saved.codigoPedido, requestedCode);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/import-txt")
    @Transactional
    public ResponseEntity<BulkImportResult> importTxt(@RequestParam("file") MultipartFile file, Authentication authentication) throws IOException {
        
        long startAll = System.currentTimeMillis();

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String originOaci = extractOrigin(file.getOriginalFilename());
        if (originOaci == null) {
            log.warn("[SHIPMENT_CRUD] import rejected because filename does not match standard");
            return ResponseEntity.badRequest().build();
        }
        String assignedAirport = userAirportCode(authenticatedUser(authentication));
        if (assignedAirport != null && !assignedAirport.equalsIgnoreCase(originOaci)) {
            log.warn("[SHIPMENT_CRUD] import rejected because assigned airport does not match file origin assigned={} origin={}", assignedAirport, originOaci);
            return ResponseEntity.status(403).build();
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
                LocalDateTime ingresoUtc = OperationalTime.localToUtc(ingresoLocal, originAirport.gmt);
                int slaHoras = computeSla(originAirport, destinoAirport);

                batch.add(new Object[]{
                    codigoPedido,
                    originAirport.id,
                    destinoAirport.id,
                    ingresoUtc,
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
            "(codigo_pedido, origen_id, destino_id, ingreso_utc, cantidad, id_cliente, sla_horas, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
            "AS new ON DUPLICATE KEY UPDATE " +
            "origen_id = new.origen_id, " +
            "destino_id = new.destino_id, " +
            "ingreso_utc = new.ingreso_utc, " +
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
    public ResponseEntity<ShipmentCrudDto> update(@PathVariable Long id, @RequestBody ShipmentCrudDto payload, Authentication authentication) {
        log.info("[SHIPMENT_CRUD] update request id={} pedido={}", id, payload != null ? payload.codigoPedido : null);
        ShipmentEntity entity = repository.findById(id).orElse(null);
        if (entity == null) {
            log.warn("[SHIPMENT_CRUD] update rejected because shipment does not exist id={}", id);
            return ResponseEntity.notFound().build();
        }
        ShipmentCrudDto previous = toDto(entity);
        if (!canAccessShipment(entity, authenticatedUser(authentication))) {
            log.warn("[SHIPMENT_CRUD] update rejected by airport scope id={}", id);
            return ResponseEntity.status(403).build();
        }
        if (!apply(entity, payload, authenticatedUser(authentication))) {
            log.warn("[SHIPMENT_CRUD] update rejected by validation id={}", id);
            return ResponseEntity.badRequest().build();
        }
        ShipmentEntity saved = repository.save(entity);
        log.info(
            "[SHIPMENT_CRUD] update saved id={} pedido={} ingresoUtc={} status={} requiresReplan={}",
            saved.id,
            saved.codigoPedido,
            saved.ingresoUtc,
            saved.status,
            requiresReplan(previous, toDto(saved))
        );
        if (requiresReplan(previous, toDto(saved))) {
            dailyPlanningService.replanNow("SHIPMENT_UPDATE", "envio");
        }
        return ResponseEntity.ok(toDto(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        ShipmentEntity entity = repository.findById(id).orElse(null);
        if (entity == null) {
            log.warn("[SHIPMENT_CRUD] delete rejected because shipment does not exist id={}", id);
            return ResponseEntity.notFound().build();
        }
        if (!canAccessShipment(entity, authenticatedUser(authentication))) {
            log.warn("[SHIPMENT_CRUD] delete rejected by airport scope id={}", id);
            return ResponseEntity.status(403).build();
        }
        log.info("[SHIPMENT_CRUD] delete id={}", id);
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private boolean apply(ShipmentEntity target, ShipmentCrudDto source, AuthenticatedUser user) {
        if (!isValid(source, user)) {
            return false;
        }
        String origenCode = userAirportCode(user) != null
            ? userAirportCode(user)
            : source.origen;
        AirportEntity origen = airportRepository.findByCodigoOaci(normalizeAirport(origenCode));
        AirportEntity destino = airportRepository.findByCodigoOaci(normalizeAirport(source.destino));
        if (origen == null || destino == null) {
            return false;
        }

        target.codigoPedido = source.codigoPedido.trim();
        target.origen = origen;
        target.destino = destino;
        LocalDateTime ingresoLocal = source.ingresoLocal != null
            ? source.ingresoLocal
            : OperationalTime.utcToLocal(LocalDateTime.now(), origen.gmt);
        target.ingresoUtc = OperationalTime.localToUtc(ingresoLocal, origen.gmt);
        target.cantidad = Math.max(0, source.cantidad);
        target.idCliente = source.idCliente.trim();
        target.slaHoras = source.slaHoras;
        target.status = source.status != null ? source.status : (target.status != null ? target.status : ShipmentStatus.PENDING);
        return true;
    }

    private ShipmentEntity saveNewShipmentWithResolvedCode(ShipmentEntity entity, String requestedCode) {
        synchronized (SHIPMENT_CODE_LOCK) {
            String candidate = resolveInitialShipmentCode(requestedCode);
            for (int attempt = 0; attempt < CREATE_CODE_RETRY_LIMIT; attempt++) {
                entity.id = null;
                entity.codigoPedido = candidate;
                try {
                    return repository.saveAndFlush(entity);
                } catch (DataIntegrityViolationException ex) {
                    log.warn(
                        "[SHIPMENT_CRUD] create collision for pedido={} attempt={} cause={}",
                        candidate,
                        attempt + 1,
                        ex.getClass().getSimpleName()
                    );
                    candidate = nextNumericShipmentCode();
                }
            }
        }
        throw new IllegalStateException("No se pudo asignar un codigo unico al envio");
    }

    private String resolveInitialShipmentCode(String requestedCode) {
        String normalized = requestedCode != null ? requestedCode.trim() : "";
        if (!isSupportedManualShipmentCode(normalized)) {
            return nextNumericShipmentCode();
        }
        return repository.findByCodigoPedido(normalized) == null
            ? normalized
            : nextNumericShipmentCode();
    }

    private boolean isSupportedManualShipmentCode(String code) {
        return code != null && code.matches("\\d{" + NUMERIC_SHIPMENT_CODE_LENGTH + "}");
    }

    private String nextNumericShipmentCode() {
        Long maxCode = repository.findMaxNumericCodigoPedido();
        long currentMax = maxCode != null ? maxCode : 0L;
        long next = currentMax + 1L;
        return String.format(Locale.ROOT, "%0" + NUMERIC_SHIPMENT_CODE_LENGTH + "d", next);
    }

    private ShipmentCrudDto toDto(ShipmentEntity entity) {
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
        dto.fecha = dto.ingresoLocal.format(DATE_FORMAT);
        dto.cantidad = entity.cantidad;
        dto.idCliente = entity.idCliente;
        dto.slaHoras = entity.slaHoras;
        dto.status = entity.status;
        dto.auditDateIns = entity.auditDateIns;
        return dto;
    }

    private boolean isValid(ShipmentCrudDto dto, AuthenticatedUser user) {
        return dto != null
            && dto.codigoPedido != null && !dto.codigoPedido.isBlank()
            && ((dto.origen != null && !dto.origen.isBlank()) || (user != null && user.airportCode() != null && !user.airportCode().isBlank()))
            && dto.destino != null && !dto.destino.isBlank()
            && dto.idCliente != null && !dto.idCliente.isBlank();
    }

    private boolean requiresReplan(ShipmentCrudDto previous, ShipmentCrudDto current) {
        return !Objects.equals(previous.origen, current.origen)
            || !Objects.equals(previous.destino, current.destino)
            || !Objects.equals(previous.ingresoUtc, current.ingresoUtc)
            || previous.cantidad != current.cantidad
            || previous.slaHoras != current.slaHoras
            || previous.status != current.status;
    }

    private String normalizeAirport(String airportCode) {
        return airportCode == null ? null : airportCode.trim().toUpperCase(Locale.ROOT);
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

    private AuthenticatedUser authenticatedUser(Authentication authentication) {
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        return principal instanceof AuthenticatedUser user ? user : null;
    }

    private String userAirportCode(AuthenticatedUser user) {
        return user != null && user.airportCode() != null && !user.airportCode().isBlank()
            ? normalizeAirport(user.airportCode())
            : null;
    }

    private boolean canAccessShipment(ShipmentEntity entity, AuthenticatedUser user) {
        String airport = userAirportCode(user);
        if (airport == null) {
            return true;
        }
        String origen = entity.origen != null ? normalizeAirport(entity.origen.codigoOaci) : null;
        String destino = entity.destino != null ? normalizeAirport(entity.destino.codigoOaci) : null;
        return airport.equals(origen) || airport.equals(destino);
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
