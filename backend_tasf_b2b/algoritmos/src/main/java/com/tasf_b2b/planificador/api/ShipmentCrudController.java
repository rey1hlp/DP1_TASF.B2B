package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/db/shipments")
public class ShipmentCrudController {
    private final ShipmentRepository repository;

    public ShipmentCrudController(ShipmentRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<Page<ShipmentEntity>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String query
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ShipmentEntity> result = (query == null || query.isBlank())
            ? repository.findAllByOrderByAuditDateInsDesc(pageable)
            : repository.findByCodigoPedidoContainingIgnoreCaseOrOrigenContainingIgnoreCaseOrDestinoContainingIgnoreCaseOrderByAuditDateInsDesc(query, query, query, pageable);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<ShipmentEntity> create(@RequestBody ShipmentEntity entity) {
        if (!isValid(entity)) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(repository.save(entity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ShipmentEntity> update(@PathVariable Long id, @RequestBody ShipmentEntity payload) {
        ShipmentEntity entity = repository.findById(id).orElse(null);
        if (entity == null) {
            return ResponseEntity.notFound().build();
        }
        copy(entity, payload);
        if (!isValid(entity)) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(repository.save(entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void copy(ShipmentEntity target, ShipmentEntity source) {
        target.codigoPedido = source.codigoPedido;
        target.origen = source.origen;
        target.destino = source.destino;
        target.fecha = source.fecha;
        target.ingresoUtc = source.ingresoUtc;
        target.ingresoLocal = source.ingresoLocal;
        target.gmtOffset = source.gmtOffset;
        target.cantidad = source.cantidad;
        target.idCliente = source.idCliente;
        target.slaHoras = source.slaHoras;
        target.asignado = source.asignado;
    }

    private boolean isValid(ShipmentEntity entity) {
        return entity != null
            && entity.codigoPedido != null && !entity.codigoPedido.isBlank()
            && entity.origen != null && !entity.origen.isBlank()
            && entity.destino != null && !entity.destino.isBlank()
            && entity.fecha != null && !entity.fecha.isBlank()
            && entity.ingresoUtc != null
            && entity.ingresoLocal != null
            && entity.idCliente != null && !entity.idCliente.isBlank();
    }
}