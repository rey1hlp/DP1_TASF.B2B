package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.api.error.ApiValidationException;
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
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Objects;

@RestController
@RequestMapping("/api/db/shipments")
public class ShipmentCrudController {
    private static final Logger log = LoggerFactory.getLogger(ShipmentCrudController.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter MYSQL_DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern PATRON_ORIGEN = Pattern.compile("_envios_([A-Za-z0-9]{4})_");
    private static final Pattern PATRON_CODIGO_TXT = Pattern.compile("\\d{9}");
    private static final Object SHIPMENT_CODE_LOCK = new Object();
    private static final int NUMERIC_SHIPMENT_CODE_LENGTH = 9;
    private static final int CREATE_CODE_RETRY_LIMIT = 4;
    private static final int AIRPORT_CODE_LENGTH = 4;

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
        log.info(
            "[SHIPMENT_CRUD][LIST] db page={} size={} query={} userAirport={} rows={} totalElements={} totalPages={}",
            page,
            size,
            query,
            airport,
            result.getNumberOfElements(),
            result.getTotalElements(),
            result.getTotalPages()
        );
        Map<Long, RawShipmentDateTimes> rawDateTimes = fetchRawShipmentDateTimes(result.getContent());
        return ResponseEntity.ok(result.map(entity -> {
            RawShipmentDateTimes raw = rawDateTimes.get(entity.id);
            log.info(
                "[SHIPMENT_CRUD][LIST][DB] id={} pedido={} origen={} destino={} ingresoUtcEntity={} ingresoUtcRaw={} cantidad={} cliente={} slaHoras={} status={} auditDateInsEntity={} auditDateInsRaw={}",
                entity.id,
                entity.codigoPedido,
                entity.origen != null ? entity.origen.codigoOaci : null,
                entity.destino != null ? entity.destino.codigoOaci : null,
                entity.ingresoUtc,
                raw != null ? raw.ingresoUtcText() : null,
                entity.cantidad,
                entity.idCliente,
                entity.slaHoras,
                entity.status,
                entity.auditDateIns,
                raw != null ? raw.auditDateInsText() : null
            );
            ShipmentCrudDto dto = toDto(entity);
            if (raw != null && raw.ingresoUtc() != null) {
                dto.ingresoUtc = raw.ingresoUtc();
                dto.ingresoLocal = OperationalTime.utcToLocal(dto.ingresoUtc, dto.origenGmt);
                dto.fecha = dto.ingresoLocal.format(DATE_FORMAT);
            }
            if (raw != null && raw.auditDateIns() != null) {
                dto.auditDateIns = raw.auditDateIns();
            }
            log.info(
                "[SHIPMENT_CRUD][LIST][DTO] id={} pedido={} origen={} destino={} ingresoUtc={} ingresoLocal={} origenGmt={} fecha={} cantidad={} cliente={} slaHoras={} status={} auditDateIns={}",
                dto.id,
                dto.codigoPedido,
                dto.origen,
                dto.destino,
                dto.ingresoUtc,
                dto.ingresoLocal,
                dto.origenGmt,
                dto.fecha,
                dto.cantidad,
                dto.idCliente,
                dto.slaHoras,
                dto.status,
                dto.auditDateIns
            );
            return dto;
        }));
    }

    private Map<Long, RawShipmentDateTimes> fetchRawShipmentDateTimes(List<ShipmentEntity> entities) {
        if (entities == null || entities.isEmpty()) {
            return Map.of();
        }

        List<Long> ids = entities.stream()
            .map(entity -> entity.id)
            .filter(Objects::nonNull)
            .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }

        String placeholders = String.join(",", ids.stream().map(id -> "?").toList());
        String sql = """
            SELECT id,
                   DATE_FORMAT(ingreso_utc, '%%Y-%%m-%%d %%H:%%i:%%s') AS ingreso_utc_raw,
                   DATE_FORMAT(audit_date_ins, '%%Y-%%m-%%d %%H:%%i:%%s') AS audit_date_ins_raw
            FROM shipment
            WHERE id IN (%s)
            """.formatted(placeholders);

        Map<Long, RawShipmentDateTimes> result = new HashMap<>();
        jdbcTemplate.query(sql, rs -> {
            Long id = rs.getLong("id");
            String ingresoUtcText = rs.getString("ingreso_utc_raw");
            String auditDateInsText = rs.getString("audit_date_ins_raw");
            result.put(id, new RawShipmentDateTimes(
                parseMysqlDateTime(ingresoUtcText),
                parseMysqlDateTime(auditDateInsText),
                ingresoUtcText,
                auditDateInsText
            ));
        }, ids.toArray());
        return result;
    }

    private LocalDateTime parseMysqlDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return LocalDateTime.parse(value, MYSQL_DATETIME_FORMAT);
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
        ShipmentEntity saved = saveNewShipmentWithResolvedCode(entity);
        log.info(
            "[SHIPMENT_CRUD] create saved id={} pedido={} ingresoUtc={} status={}",
            saved.id,
            saved.codigoPedido,
            saved.ingresoUtc,
            saved.status
        );
        dailyPlanningService.replanNow("SHIPMENT_CREATE", "nuevo envio");
        return ResponseEntity.ok(toDto(saved));
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
        LocalDateTime importIngresoUtc = LocalDateTime.ofInstant(Instant.now(), ZoneOffset.UTC);

        int total = 0;
        int inserted = 0;
        int updated = 0;
        int skipped = 0;
        List<String> invalidFormat = new ArrayList<>();
        List<String> invalidAirport = new ArrayList<>();
        List<String> invalidCapacity = new ArrayList<>();
        
        List<ImportedShipmentDraft> drafts = new ArrayList<>();
        List<String> registeredCodes = new ArrayList<>();

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

                // Fecha y hora del TXT se ignoran: la carga usa el reloj local del aeropuerto de la cuenta.
                String destinoOaci = parts[4].trim().toUpperCase(Locale.ROOT);
                String cantidadTxt = parts[5].trim();
                String idCliente = parts[6].trim();

                if (idCliente.isBlank()) {
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

                int cantidad;
                try {
                    cantidad = Integer.parseInt(cantidadTxt);
                } catch (NumberFormatException ex) {
                    skipped++;
                    invalidFormat.add(line);
                    continue;
                }

                try {
                    validateShipmentQuantityAndCapacity(cantidad, originAirport, destinoAirport);
                } catch (ApiValidationException ex) {
                    skipped++;
                    invalidCapacity.add(formatImportValidationLine(line, ex));
                    continue;
                }

                int slaHoras = computeSla(originAirport, destinoAirport);

                drafts.add(new ImportedShipmentDraft(
                    destinoAirport,
                    importIngresoUtc,
                    cantidad,
                    idCliente,
                    slaHoras
                ));

            }
        }

        // Procesar último lote
        if (!drafts.isEmpty()) {
            registeredCodes = persistImportedShipments(originAirport, drafts);
            inserted = registeredCodes.size();
        }

        if (inserted > 0) {
            triggerReplanAsync("SHIPMENT_IMPORT", "txt masivo");
        }

        long elapsed = System.currentTimeMillis() - startAll;
        log.info("[SHIPMENT_CRUD] import finished file={} origin={} total={} inserted={} updated={} skipped={} time={}ms",
            file.getOriginalFilename(), originOaci, total, inserted, updated, skipped, elapsed);

        return ResponseEntity.ok(new BulkImportResult(total, inserted, updated, skipped, invalidFormat, invalidAirport, registeredCodes, invalidCapacity));
    }

    private int[] executeShipmentInsertBatch(List<Object[]> batch) {
        String sql = 
            "INSERT INTO shipment " +
            "(codigo_pedido, origen_id, destino_id, ingreso_utc, cantidad, id_cliente, sla_horas, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        return jdbcTemplate.batchUpdate(sql, batch);
    }

    private List<String> persistImportedShipments(AirportEntity originAirport, List<ImportedShipmentDraft> drafts) {
        String originCode = originAirport != null ? normalizeAirport(originAirport.codigoOaci) : null;
        if (originCode == null || originCode.length() != AIRPORT_CODE_LENGTH) {
            throw new IllegalStateException("No se pudo resolver el aeropuerto de origen para importar los envios");
        }

        synchronized (SHIPMENT_CODE_LOCK) {
            long nextNumericCode = nextShipmentNumericCode(originCode);
            List<Object[]> batch = new ArrayList<>(drafts.size());
            List<String> assignedCodes = new ArrayList<>(drafts.size());

            for (ImportedShipmentDraft draft : drafts) {
                String codigoPedido = originCode + String.format(Locale.ROOT, "%0" + NUMERIC_SHIPMENT_CODE_LENGTH + "d", nextNumericCode++);
                assignedCodes.add(codigoPedido);
                batch.add(new Object[]{
                    codigoPedido,
                    originAirport.id,
                    draft.destinoAirport().id,
                    draft.ingresoUtc(),
                    draft.cantidad(),
                    draft.idCliente(),
                    draft.slaHoras(),
                    ShipmentStatus.PENDING.name()
                });
            }

            executeShipmentInsertBatch(batch);
            return assignedCodes;
        }
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
        ResolvedShipmentValidation resolved = validateShipmentRequest(source, user);
        AirportEntity origen = resolved.origen();
        AirportEntity destino = resolved.destino();

        if (target.id == null) {
            target.codigoPedido = source.codigoPedido != null ? source.codigoPedido.trim() : null;
        }
        target.origen = origen;
        target.destino = destino;
        LocalDateTime ingresoLocal = source.ingresoLocal != null
            ? source.ingresoLocal
            : OperationalTime.utcToLocal(LocalDateTime.now(), origen.gmt);
        target.ingresoUtc = OperationalTime.localToUtc(ingresoLocal, origen.gmt);
        target.cantidad = source.cantidad;
        target.idCliente = source.idCliente.trim();
        target.slaHoras = source.slaHoras;
        target.status = source.status != null ? source.status : (target.status != null ? target.status : ShipmentStatus.PENDING);
        return true;
    }

    private ResolvedShipmentValidation validateShipmentRequest(ShipmentCrudDto source, AuthenticatedUser user) {
        if (source == null) {
            throw new ApiValidationException("SHIPMENT_REQUIRED", "El envio es obligatorio");
        }

        String assignedOrigin = userAirportCode(user);
        String origenCode = assignedOrigin != null ? assignedOrigin : source.origen;
        if (origenCode == null || origenCode.isBlank()) {
            throw new ApiValidationException("SHIPMENT_ORIGIN_REQUIRED", "El aeropuerto origen es obligatorio");
        }
        if (source.destino == null || source.destino.isBlank()) {
            throw new ApiValidationException("SHIPMENT_DESTINATION_REQUIRED", "El aeropuerto destino es obligatorio");
        }
        if (source.idCliente == null || source.idCliente.isBlank()) {
            throw new ApiValidationException("SHIPMENT_CUSTOMER_REQUIRED", "El cliente es obligatorio");
        }

        AirportEntity origen = airportRepository.findByCodigoOaci(normalizeAirport(origenCode));
        AirportEntity destino = airportRepository.findByCodigoOaci(normalizeAirport(source.destino));
        if (origen == null) {
            throw new ApiValidationException(
                "SHIPMENT_ORIGIN_NOT_FOUND",
                "El aeropuerto origen no existe",
                Map.of("airportCode", normalizeAirport(origenCode))
            );
        }
        if (destino == null) {
            throw new ApiValidationException(
                "SHIPMENT_DESTINATION_NOT_FOUND",
                "El aeropuerto destino no existe",
                Map.of("airportCode", normalizeAirport(source.destino))
            );
        }

        validateShipmentQuantityAndCapacity(source.cantidad, origen, destino);
        return new ResolvedShipmentValidation(origen, destino);
    }

    private void validateShipmentQuantityAndCapacity(int cantidad, AirportEntity origen, AirportEntity destino) {
        if (cantidad <= 0) {
            throw new ApiValidationException(
                "SHIPMENT_QUANTITY_INVALID",
                "La cantidad debe ser mayor a 0",
                Map.of("cantidad", cantidad)
            );
        }

        if (origen != null && cantidad > origen.capacidad) {
            throw new ApiValidationException(
                "SHIPMENT_ORIGIN_CAPACITY_EXCEEDED",
                String.format(
                    Locale.ROOT,
                    "La cantidad (%d) supera la capacidad del aeropuerto origen %s (%d)",
                    cantidad,
                    normalizeAirport(origen.codigoOaci),
                    origen.capacidad
                ),
                airportCapacityDetails(cantidad, "origen", origen)
            );
        }

        if (destino != null && cantidad > destino.capacidad) {
            throw new ApiValidationException(
                "SHIPMENT_DESTINATION_CAPACITY_EXCEEDED",
                String.format(
                    Locale.ROOT,
                    "La cantidad (%d) supera la capacidad del aeropuerto destino %s (%d)",
                    cantidad,
                    normalizeAirport(destino.codigoOaci),
                    destino.capacidad
                ),
                airportCapacityDetails(cantidad, "destino", destino)
            );
        }
    }

    private Map<String, Object> airportCapacityDetails(int cantidad, String airportRole, AirportEntity airport) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("cantidad", cantidad);
        details.put("airportRole", airportRole);
        details.put("airportCode", normalizeAirport(airport.codigoOaci));
        details.put("capacity", airport.capacidad);
        return details;
    }

    private String formatImportValidationLine(String line, ApiValidationException ex) {
        return line + " | " + ex.getMessage();
    }

    private ShipmentEntity saveNewShipmentWithResolvedCode(ShipmentEntity entity) {
        String originCode = entity.origen != null ? normalizeAirport(entity.origen.codigoOaci) : null;
        if (originCode == null || originCode.length() != AIRPORT_CODE_LENGTH) {
            throw new IllegalStateException("No se pudo resolver el aeropuerto de origen para generar el codigo del envio");
        }
        synchronized (SHIPMENT_CODE_LOCK) {
            String candidate = nextShipmentCode(originCode);
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
                    candidate = nextShipmentCode(originCode);
                }
            }
        }
        throw new IllegalStateException("No se pudo asignar un codigo unico al envio");
    }

    private String nextShipmentCode(String originCode) {
        long next = nextShipmentNumericCode(originCode);
        return originCode + String.format(Locale.ROOT, "%0" + NUMERIC_SHIPMENT_CODE_LENGTH + "d", next);
    }

    private long nextShipmentNumericCode(String originCode) {
        Long maxCode = repository.findMaxNumericCodigoPedidoByPrefix(originCode);
        long currentMax = maxCode != null ? maxCode : 0L;
        return currentMax + 1L;
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
        List<String> invalidAirportLines,
        List<String> registeredCodes,
        List<String> invalidCapacityLines
    ) {}

    private record ResolvedShipmentValidation(
        AirportEntity origen,
        AirportEntity destino
    ) {}

    private record ImportedShipmentDraft(
        AirportEntity destinoAirport,
        LocalDateTime ingresoUtc,
        int cantidad,
        String idCliente,
        int slaHoras
    ) {}

    private record RawShipmentDateTimes(
        LocalDateTime ingresoUtc,
        LocalDateTime auditDateIns,
        String ingresoUtcText,
        String auditDateInsText
    ) {}
}
