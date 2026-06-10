package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.AirportCrudDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import org.springframework.http.ResponseEntity;

import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/db/airports")
public class AirportWarehouseController {

    private final JdbcTemplate jdbcTemplate;
    private final AirportRepository airportRepository;

    public AirportWarehouseController(JdbcTemplate jdbcTemplate, AirportRepository airportRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.airportRepository = airportRepository;
    }

    @GetMapping("/{oaci}")
    public ResponseEntity<AirportCrudDto> getAirportByOaci(@PathVariable String oaci) {
        AirportEntity entity = airportRepository.findByCodigoOaci(oaci.toUpperCase());
        if (entity == null) {
            return ResponseEntity.notFound().build();
        }
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
        return ResponseEntity.ok(dto);
    }

    // Endpoint que expone la carga actual (envíos listos en el origen) de un aeropuerto por su código OACI
    @GetMapping("/{oaci}/warehouse-shipments")
    public ResponseEntity<List<ShipmentCrudDto>> getWarehouseShipments(@PathVariable String oaci) {
        
        // Query que trae los paquetes cuyo origen es el aeropuerto seleccionado
        // Puedes filtrar por `s.asignado = 0` si solo quieres ver los que están en cola de espera en almacén
        String sql = "SELECT s.id, s.codigo_pedido, ao.codigo_oaci as origen_oaci, ao.ciudad as origen_ciudad, " +
                     "ad.codigo_oaci as destino_oaci, ad.ciudad as destino_ciudad, s.fecha, " +
                     "s.hora_ingreso_utc, s.hora_ingreso_local, s.gmt_offset, s.cantidad, " +
                     "s.id_cliente, s.sla_horas, s.asignado, s.audit_date_ins " +
                     "FROM shipment s " +
                     "JOIN airport ao ON s.origen_id = ao.id " +
                     "JOIN airport ad ON s.destino_id = ad.id " +
                     "WHERE ao.codigo_oaci = ? ORDER BY s.hora_ingreso_utc DESC";

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
        }, oaci.toUpperCase());

        return ResponseEntity.ok(shipments);
    }
}
