package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Objects;

@RestController
@RequestMapping("/api/db/shipments")
public class ShipmentCrudController {
    private static final Logger log = LoggerFactory.getLogger(ShipmentCrudController.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

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
}
