package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.AirportDto;
import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.utils.RutaResolver;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/airports")
public class AirportController {
    @GetMapping
    public ResponseEntity<List<AirportDto>> listar() throws Exception {
        String raiz = System.getProperty("user.dir");
        Path rutaAeropuertosTxt = RutaResolver.resolverRutaData(raiz, "aeropuertos.txt");
        Path rutaAeropuertosCsv = RutaResolver.resolverRutaData(raiz, "aeropuertos.csv");

        UtilArchivos util = new UtilArchivos();
        Map<String, Aeropuerto> aeropuertos = util.cargarAeropuertos(rutaAeropuertosTxt, rutaAeropuertosCsv);
        List<AirportDto> lista = aeropuertos.values().stream().map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(lista);
    }

    private AirportDto toDto(Aeropuerto a) {
        AirportDto dto = new AirportDto();
        dto.codigoOaci = a.codigoOaci;
        dto.nombre = a.nombre;
        dto.pais = a.pais;
        dto.capacidad = a.capacidad;
        dto.gmt = a.gmt;
        dto.latitud = a.latitud;
        dto.longitud = a.longitud;
        return dto;
    }
}
