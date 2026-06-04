package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
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

    public ShipmentCrudController(
        ShipmentRepository repository,
        AirportRepository airportRepository,
        DailyPlanningService dailyPlanningService
    ) {
        this.repository = repository;
        this.airportRepository = airportRepository;
        this.dailyPlanningService = dailyPlanningService;
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

    @PostMapping
    public ResponseEntity<ShipmentCrudDto> create(@RequestBody ShipmentCrudDto dto) {
        log.info(
            "[SHIPMENT_CRUD] create request pedido={} origen={} destino={} fecha={} ingresoLocal={} ingresoUtc={} gmtOffset={} cantidad={} cliente={} slaHoras={} asignado={}",
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
            dto != null && dto.asignado
        );
        ShipmentEntity entity = new ShipmentEntity();
        if (!apply(entity, dto)) {
            log.warn("[SHIPMENT_CRUD] create rejected by validation");
            return ResponseEntity.badRequest().build();
        }
        ShipmentEntity saved = repository.save(entity);
        log.info(
            "[SHIPMENT_CRUD] create saved id={} pedido={} fecha={} ingresoLocal={} asignado={}",
            saved.id,
            saved.codigoPedido,
            saved.fecha,
            saved.ingresoLocal,
            saved.asignado
        );
        dailyPlanningService.replanNow("SHIPMENT_CREATE", "nuevo envio");
        return ResponseEntity.ok(toDto(saved));
    }

    @PostMapping("/import-txt")
    public ResponseEntity<BulkImportResult> importTxt(@RequestParam("file") MultipartFile file) throws IOException {
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

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                total++;

                String[] parts = trimmed.split("-");
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

                AirportEntity destinoAirport = airportRepository.findByCodigoOaci(destinoOaci);
                if (destinoAirport == null) {
                    skipped++;
                    invalidAirport.add(line);
                    continue;
                }

                int hh;
                int mm;
                int cantidad;
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

                ShipmentEntity entity = repository.findByCodigoPedido(codigoPedido);
                boolean existed = entity != null;
                if (!existed) {
                    entity = new ShipmentEntity();
                }

                entity.codigoPedido = codigoPedido;
                entity.origen = originAirport;
                entity.destino = destinoAirport;
                entity.fecha = fecha;
                entity.ingresoLocal = ingresoLocal;
                entity.ingresoUtc = ingresoUtc;
                entity.gmtOffset = originAirport.gmt;
                entity.cantidad = cantidad;
                entity.idCliente = idCliente;
                entity.slaHoras = slaHoras;
                entity.asignado = false;

                repository.save(entity);
                if (existed) {
                    updated++;
                } else {
                    inserted++;
                }
            }
        }

        if (inserted + updated > 0) {
            dailyPlanningService.replanNow("SHIPMENT_IMPORT", "txt masivo");
        }

        log.info(
            "[SHIPMENT_CRUD] import finished file={} origin={} total={} inserted={} updated={} skipped={}",
            file.getOriginalFilename(),
            originOaci,
            total,
            inserted,
            updated,
            skipped
        );
        return ResponseEntity.ok(new BulkImportResult(total, inserted, updated, skipped, invalidFormat, invalidAirport));
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
            "[SHIPMENT_CRUD] update saved id={} pedido={} fecha={} ingresoLocal={} asignado={} requiresReplan={}",
            saved.id,
            saved.codigoPedido,
            saved.fecha,
            saved.ingresoLocal,
            saved.asignado,
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
        target.asignado = source.asignado;
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
        dto.asignado = entity.asignado;
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
            || previous.asignado != current.asignado;
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
