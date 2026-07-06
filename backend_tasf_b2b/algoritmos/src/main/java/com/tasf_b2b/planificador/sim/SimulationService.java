package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.api.dto.WarehouseEventDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;
import com.tasf_b2b.planificador.api.dto.PasoRutaDto;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.persistence.SimulationRunEntity;
import com.tasf_b2b.planificador.persistence.SimulationRunRepository;
import com.tasf_b2b.planificador.api.dto.SimulationRequest;
import com.tasf_b2b.planificador.api.dto.SimulationResponse;
import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;
import com.tasf_b2b.planificador.experimentos.BuscadorColapso;
import com.tasf_b2b.planificador.nucleo.GrafoVuelos;
import com.tasf_b2b.planificador.nucleo.Individuo;
import com.tasf_b2b.planificador.nucleo.ObjetivoConfig;
import com.tasf_b2b.planificador.nucleo.ParametrosGa;
import com.tasf_b2b.planificador.nucleo.PlanificadorGa;
import com.tasf_b2b.planificador.nucleo.Ruta;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import com.tasf_b2b.planificador.utils.ReporteRutas;
import com.tasf_b2b.planificador.utils.ReporteSinRuta;
import com.tasf_b2b.planificador.utils.RutaResolver;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationEntity;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class SimulationService {
    private static final DateTimeFormatter FECHA_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final int DEFAULT_POBLACION = 50;
    private static final int DEFAULT_GENERACIONES = 100;
    private static final double DEFAULT_CRUCE = 0.85;
    private static final double DEFAULT_MUTACION = 0.05;
    private static final int DEFAULT_TORNEO = 5;
    private static final double DEFAULT_SPEED_MIN_PER_SEC = 4.0;
    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    private final SimulationRegistry registry;
    private final SimulationRunRepository simulationRunRepository;
    private final AirportRepository airportRepository;
    private final FlightRepository flightRepository;
    private final FlightDayCancellationRepository cancellationRepository;
    private final com.tasf_b2b.planificador.persistence.ShipmentRepository shipmentRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public SimulationService(
        SimulationRegistry registry,
        SimulationRunRepository simulationRunRepository,
        AirportRepository airportRepository,
        FlightRepository flightRepository,
        FlightDayCancellationRepository cancellationRepository,
        com.tasf_b2b.planificador.persistence.ShipmentRepository shipmentRepository
    ) {
        this.registry = registry;
        this.simulationRunRepository = simulationRunRepository;
        this.airportRepository = airportRepository;
        this.flightRepository = flightRepository;
        this.cancellationRepository = cancellationRepository;
        this.shipmentRepository = shipmentRepository;
    }
    
    public java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> getShipmentsByFlight(
        String simId, Long flightId) {
        return getShipmentsByFlight(simId, flightId, null, null);
    }

    public java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> getShipmentsByFlight(
        String simId, Long flightId, Integer planId, Integer salidaMinParam) {

        SimulationState state = registry.get(simId);  // usa 'registry', no 'simulationRegistry'
        if (state == null || state.data == null || state.data.rutasPorPaquete == null) {
            log.warn(
                "[SIM:{}][SHIPMENTS_BY_FLIGHT] state missing or incomplete flightId={} hasData={} hasRoutes={}",
                simId,
                flightId,
                state != null && state.data != null,
                state != null && state.data != null && state.data.rutasPorPaquete != null
            );
            return null;
        }

        // Localizar el segmento EXACTO del vuelo seleccionado para obtener su horario ESTABLE
        // (origen, destino, salidaMin, llegadaMin en minutos absolutos), con el que casaremos rutas.
        // Preferimos identificarlo por (planId + salidaMin), que es único por instancia de vuelo,
        // porque el índice interno flightId se reinicia por bloque y puede colisionar al fusionarse.
        FlightSegmentDto segmento = null;
        if (state.data.vuelos != null) {
            if (planId != null && salidaMinParam != null) {
                segmento = state.data.vuelos.stream()
                    .filter(seg -> seg != null && seg.planId == planId && seg.salidaMin == salidaMinParam.intValue())
                    .findFirst()
                    .orElse(null);
            }
            if (segmento == null) {
                segmento = state.data.vuelos.stream()
                    .filter(seg -> seg != null && seg.flightId == flightId.intValue())
                    .findFirst()
                    .orElse(null);
            }
        }
        final FlightSegmentDto segmentoRef = segmento;

        log.info(
            "[SIM:{}][SHIPMENTS_BY_FLIGHT] start flightId={} routes={} envios={} segmento={}",
            simId,
            flightId,
            state.data.rutasPorPaquete.size(),
            state.data.enviosPorCodigo != null ? state.data.enviosPorCodigo.size() : -1,
            segmentoRef != null
                ? (segmentoRef.origen + "->" + segmentoRef.destino
                    + " [" + segmentoRef.salidaMin + "," + segmentoRef.llegadaMin + "]")
                : "null"
        );

        // 1. Filtrar los codigoPedido cuya ruta pasa por este vuelo.
        //    Si conocemos el horario del segmento, casamos por horario estable
        //    (origen+destino+salidaMin+llegadaMin); si no, caemos al índice interno como respaldo.
        java.util.List<String> codes = new java.util.ArrayList<>();
        for (java.util.Map.Entry<String, RespuestaRutaEnvioDto> entry
                : state.data.rutasPorPaquete.entrySet()) {
            RespuestaRutaEnvioDto ruta = entry.getValue();
            if (ruta == null || ruta.ruta == null) continue;
            boolean perteneceAlVuelo = ruta.ruta.stream().anyMatch(paso -> {
                if (paso == null) return false;
                if (segmentoRef != null) {
                    return segmentoRef.origen != null
                        && segmentoRef.destino != null
                        && segmentoRef.origen.equalsIgnoreCase(paso.origen)
                        && segmentoRef.destino.equalsIgnoreCase(paso.destino)
                        && paso.salidaMin == segmentoRef.salidaMin
                        && paso.llegadaMin == segmentoRef.llegadaMin;
                }
                return paso.vueloId == flightId.intValue();
            });
            if (perteneceAlVuelo) {
                codes.add(entry.getKey());
            }
        }

        log.info(
            "[SIM:{}][SHIPMENTS_BY_FLIGHT] matched codes flightId={} total={} sample={}",
            simId,
            flightId,
            codes.size(),
            codes.stream().limit(10).toList()
        );

        if (codes.isEmpty()) {
            log.warn("[SIM:{}][SHIPMENTS_BY_FLIGHT] no route codes matched flightId={}", simId, flightId);
            return java.util.Collections.emptyList();
        }

        // 2. Mapear los códigos a DTOs desde el índice en memoria (envíos de la simulación).
        java.util.List<ShipmentCrudDto> inMemory = new java.util.ArrayList<>();
        if (state.data.enviosPorCodigo != null && !state.data.enviosPorCodigo.isEmpty()) {
            for (String code : codes) {
                ShipmentCrudDto dto = state.data.enviosPorCodigo.get(code);
                if (dto != null) {
                    inMemory.add(dto);
                }
            }
        }

        if (!inMemory.isEmpty()) {
            log.info(
                "[SIM:{}][SHIPMENTS_BY_FLIGHT] in-memory shipments flightId={} total={} sample={}",
                simId,
                flightId,
                inMemory.size(),
                inMemory.stream().limit(10).map(s -> s.codigoPedido).toList()
            );
            return inMemory;
        }

        // 3. Último recurso: cruzar los códigos ya emparejados contra la BD.
        log.warn(
            "[SIM:{}][SHIPMENTS_BY_FLIGHT] in-memory shipments empty, fallback to DB flightId={} codes={}",
            simId,
            flightId,
            codes
        );
        java.util.List<ShipmentCrudDto> fromDb = shipmentRepository.findByCodigoPedidoIn(codes).stream()
                .map(this::toShipmentDto)
                .collect(java.util.stream.Collectors.toList());

        log.info(
            "[SIM:{}][SHIPMENTS_BY_FLIGHT] db fallback result flightId={} total={} sample={}",
            simId,
            flightId,
            fromDb.size(),
            fromDb.stream().limit(10).map(s -> s.codigoPedido).toList()
        );
        return fromDb;
    }

    public java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> getShipmentsByAirport(
        String simId,
        String airportCode,
        Integer minute) {

        SimulationState state = registry.get(simId);
        if (state == null || state.data == null || state.data.rutasPorPaquete == null) {
            log.warn(
                "[SIM:{}][SHIPMENTS_BY_AIRPORT] state missing or incomplete airport={} minute={} hasData={} hasRoutes={}",
                simId,
                airportCode,
                minute,
                state != null && state.data != null,
                state != null && state.data != null && state.data.rutasPorPaquete != null
            );
            return null;
        }

        String airport = airportCode == null ? null : airportCode.trim().toUpperCase(java.util.Locale.ROOT);
        if (airport == null || airport.isBlank()) {
            log.warn("[SIM:{}][SHIPMENTS_BY_AIRPORT] invalid airport code airport={} minute={}", simId, airportCode, minute);
            return java.util.Collections.emptyList();
        }

        java.util.LinkedHashSet<String> matchedCodes = new java.util.LinkedHashSet<>();
        for (java.util.Map.Entry<String, RespuestaRutaEnvioDto> entry : state.data.rutasPorPaquete.entrySet()) {
            RespuestaRutaEnvioDto ruta = entry.getValue();
            if (ruta == null || ruta.ruta == null || ruta.ruta.isEmpty()) {
                continue;
            }

            // Solo interesan los envíos que LLEGAN a este almacén (destino final o en tránsito/escala),
            // es decir, algún paso cuyo destino sea el aeropuerto. NO los que solo lo usan como origen
            // de un salto futuro (esos aún están en su origen real y no han pasado por este almacén).
            boolean matchesAirport = ruta.ruta.stream().anyMatch(paso -> {
                if (paso == null || !airport.equalsIgnoreCase(paso.destino)) {
                    return false;
                }
                if (minute == null) {
                    return true;
                }
                // El vuelo hacia este almacén ya despegó: el envío va en el aire hacia SEQM
                // o ya aterrizó y está en el almacén.
                return minute >= paso.salidaMin;
            });

            if (matchesAirport) {
                matchedCodes.add(entry.getKey());
            }
        }

        log.info(
            "[SIM:{}][SHIPMENTS_BY_AIRPORT] airport={} minute={} matchedCodes={} sample={}",
            simId,
            airport,
            minute,
            matchedCodes.size(),
            matchedCodes.stream().limit(10).toList()
        );

        if (matchedCodes.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        java.util.List<ShipmentCrudDto> inMemory = new java.util.ArrayList<>();
        if (state.data.enviosPorCodigo != null && !state.data.enviosPorCodigo.isEmpty()) {
            for (String code : matchedCodes) {
                ShipmentCrudDto dto = state.data.enviosPorCodigo.get(code);
                if (dto != null) {
                    inMemory.add(dto);
                }
            }
        }

        if (!inMemory.isEmpty()) {
            log.info(
                "[SIM:{}][SHIPMENTS_BY_AIRPORT] in-memory shipments airport={} total={} sample={}",
                simId,
                airport,
                inMemory.size(),
                inMemory.stream().limit(10).map(s -> s.codigoPedido).toList()
            );
            return inMemory;
        }

        log.warn(
            "[SIM:{}][SHIPMENTS_BY_AIRPORT] in-memory empty, fallback to db airport={} codes={}",
            simId,
            airport,
            matchedCodes
        );
        java.util.List<ShipmentCrudDto> fromDb = shipmentRepository.findByCodigoPedidoIn(new java.util.ArrayList<>(matchedCodes)).stream()
            .map(this::toShipmentDto)
            .collect(java.util.stream.Collectors.toList());

        log.info(
            "[SIM:{}][SHIPMENTS_BY_AIRPORT] db fallback airport={} total={} sample={}",
            simId,
            airport,
            fromDb.size(),
            fromDb.stream().limit(10).map(s -> s.codigoPedido).toList()
        );
        return fromDb;
    }

    private com.tasf_b2b.planificador.api.dto.ShipmentCrudDto toShipmentDto(
            com.tasf_b2b.planificador.persistence.ShipmentEntity entity) {
        com.tasf_b2b.planificador.api.dto.ShipmentCrudDto dto =
                new com.tasf_b2b.planificador.api.dto.ShipmentCrudDto();
        dto.id           = entity.id;
        dto.codigoPedido = entity.codigoPedido;
        dto.origen       = entity.origen != null ? entity.origen.codigoOaci : null;
        dto.origenCiudad = entity.origen != null ? entity.origen.ciudad : null;
        dto.destino      = entity.destino != null ? entity.destino.codigoOaci : null;
        dto.destinoCiudad= entity.destino != null ? entity.destino.ciudad : null;
        dto.fecha        = entity.fecha;
        dto.ingresoUtc   = entity.ingresoUtc;
        dto.ingresoLocal = entity.ingresoLocal;
        dto.gmtOffset    = entity.gmtOffset;
        dto.cantidad     = entity.cantidad;
        dto.idCliente    = entity.idCliente;
        dto.slaHoras     = entity.slaHoras;
        dto.status       = entity.status;
        dto.auditDateIns = entity.auditDateIns;
        return dto;
    }

    private ShipmentCrudDto toShipmentDto(com.tasf_b2b.planificador.dominio.Envio envio) {
        ShipmentCrudDto dto = new ShipmentCrudDto();
        dto.codigoPedido = envio.idPedido;
        dto.origen = envio.origen;
        dto.destino = envio.destino;
        dto.fecha = envio.fecha;
        dto.gmtOffset = envio.gmtOffset;
        dto.cantidad = envio.cantidad;
        dto.idCliente = envio.idCliente;
        dto.slaHoras = envio.slaHoras;
        dto.status = envio.status;
        return dto;
    }

    private java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> buildShipmentsByFlight(
        java.util.Map<String, RespuestaRutaEnvioDto> rutasPorPaquete,
        java.util.Map<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> enviosPorCodigo
    ) {
        java.util.Map<Integer, java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> grouped =
            new java.util.LinkedHashMap<>();

        if (rutasPorPaquete == null || rutasPorPaquete.isEmpty() || enviosPorCodigo == null || enviosPorCodigo.isEmpty()) {
            return new java.util.LinkedHashMap<>();
        }

        for (java.util.Map.Entry<String, RespuestaRutaEnvioDto> entry : rutasPorPaquete.entrySet()) {
            String codigo = entry.getKey();
            RespuestaRutaEnvioDto ruta = entry.getValue();
            ShipmentCrudDto dto = enviosPorCodigo.get(codigo);
            if (ruta == null || ruta.ruta == null || dto == null) {
                continue;
            }
            for (PasoRutaDto paso : ruta.ruta) {
                if (paso == null) {
                    continue;
                }
                java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> bucket =
                    grouped.computeIfAbsent(paso.vueloId, k -> new java.util.LinkedHashMap<>());
                bucket.putIfAbsent(codigo, dto);
            }
        }

        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> result =
            new java.util.LinkedHashMap<>();
        for (java.util.Map.Entry<Integer, java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), new java.util.ArrayList<>(entry.getValue().values()));
        }
        return result;
    }


    public SimulationResponse startSimulation(SimulationRequest request) {
        String simulationId = UUID.randomUUID().toString();
        boolean collapseStreaming = Boolean.TRUE.equals(request.colapsoIncremental);
        SimulationResponse response = new SimulationResponse();
        response.simulationId = simulationId;
        response.status = SimulationState.Status.RUNNING.name();
        response.inicio = request.inicio;
        response.fin = (request.fin == null || request.fin.isBlank())
            ? ((request.inicio != null && request.dias != null) ? calcularFinDesdeInicio(request.inicio, request.dias) : null)
            : request.fin;
        response.speedMinPerSec = (request.speedMinPerSec != null && request.speedMinPerSec > 0)
            ? request.speedMinPerSec
            : DEFAULT_SPEED_MIN_PER_SEC;
        response.modo = collapseStreaming ? "COLAPSO_INCREMENTAL" : "PERIODO";
        response.message = "RUNNING";
        // de momento, para que siempre genere reporte en el back
        request.reporte = true;

        SimulationRunEntity run = new SimulationRunEntity();
        run.simulationId = simulationId;
        run.tipo = collapseStreaming
            ? "COLAPSO_INCREMENTAL"
            : ((request.buscarColapso != null && request.buscarColapso) ? "COLAPSO" : "PERIODO");
        run.inicio = request.inicio;
        run.fin = response.fin;
        run.dias = request.dias;
        run.estado = SimulationState.Status.RUNNING.name();
        run.speedMinPerSec = response.speedMinPerSec;
        run.creadoEn = LocalDateTime.now();
        simulationRunRepository.save(run);
        log.info("[SIM:{}] run created tipo={} inicio={} fin={} dias={} buscarColapso={} colapsoIncremental={}",
            simulationId,
            run.tipo,
            run.inicio,
            run.fin,
            run.dias,
            request.buscarColapso,
            request.colapsoIncremental);

        registry.create(simulationId);
        SimulationState created = registry.get(simulationId);
        if (created != null) {
            created.incremental = collapseStreaming;
            created.request = request;
        }

        executor.submit(() -> {
            if (collapseStreaming) {
                ejecutarColapsoIncremental(simulationId, request);
            } else {
                ejecutar(simulationId, request);
            }
        });
        return response;
    }

    private void ejecutar(String simulationId, SimulationRequest request) {
        long simulationStart = System.currentTimeMillis();
        try {
    
            log.info("[SIM:{}] Simulation started", simulationId);
    
            String raiz = System.getProperty("user.dir");
            UtilArchivos util = new UtilArchivos();
    
            String archivoEnvios = resolverArchivoEnvios(request);
            String inicio = request.inicio;
            String fin = resolverFechaFin(request);
    
            log.info(
                "[SIM:{}] Input params -> inicio={}, fin={}, archivoEnvios={}",
                simulationId,
                inicio,
                fin,
                archivoEnvios
            );
    
            // =========================
            // RESOLVER RUTAS
            // =========================
    
            Path rutaEnvios =
                RutaResolver.resolverRutaData(raiz, archivoEnvios);
    
            // =========================
            // CARGAR AEROPUERTOS
            // =========================
    
            long tAeropuertos = System.currentTimeMillis();
    
            Map<String, Aeropuerto> aeropuertos = cargarAeropuertosDb();
    
            log.info(
                "[SIM:{}] Loaded {} airports in {} ms",
                simulationId,
                aeropuertos.size(),
                System.currentTimeMillis() - tAeropuertos
            );

            if (aeropuertos.isEmpty()) {
                registry.markFailed(
                    simulationId,
                    "No hay aeropuertos registrados en la base de datos."
                );
                return;
            }
    
            // =========================
            // CARGAR ENVIOS
            // =========================
    
            long tEnvios = System.currentTimeMillis();
    
            List<Envio> envios =
                util.cargarEnvios(
                    rutaEnvios,
                    aeropuertos.keySet(),
                    aeropuertos,
                    inicio,
                    fin
                );
    
            log.info(
                "[SIM:{}] Loaded {} shipments in {} ms",
                simulationId,
                envios.size(),
                System.currentTimeMillis() - tEnvios
            );
    
            envios = limitarEnvios(request, envios);
    
            if (envios.isEmpty()) {
    
                log.warn(
                    "[SIM:{}] No shipments found in requested window",
                    simulationId
                );
    
                registry.markFailed(
                    simulationId,
                    "No hay envios en la ventana solicitada."
                );
    
                return;
            }
    
            // =========================
            // CALCULAR VENTANA
            // =========================
    
            int diaMin =
                envios.stream()
                    .mapToInt(e -> e.diaIndex)
                    .min()
                    .orElse(0);
    
            int diaMax =
                envios.stream()
                    .mapToInt(e -> e.diaIndex)
                    .max()
                    .orElse(diaMin);
    
            int maxSlaHoras =
                envios.stream()
                    .mapToInt(e -> e.slaHoras)
                    .max()
                    .orElse(0);
    
            int diasExtra =
                resolverDiasExtra(request, maxSlaHoras);
    
            log.info(
                "[SIM:{}] Window -> diaMin={}, diaMax={}, diasExtra={}",
                simulationId,
                diaMin,
                diaMax,
                diasExtra
            );
    
            // =========================
            // CARGAR PLANES
            // =========================
    
            long tPlanes = System.currentTimeMillis();
    
            List<Vuelo> planes = cargarVuelosDb(aeropuertos.keySet());
    
            log.info(
                "[SIM:{}] Loaded {} flight plans in {} ms",
                simulationId,
                planes.size(),
                System.currentTimeMillis() - tPlanes
            );
    
            ParametrosGa params = construirParametros(request);
    
            // =========================
            // BUSQUEDA DE COLAPSO
            // =========================
    
            if (Boolean.TRUE.equals(request.buscarColapso)) {
    
                log.info(
                    "[SIM:{}] Running collapse search",
                    simulationId
                );
    
                BuscadorColapso.ResultadoVentana ventana =
                    BuscadorColapso.buscarPuntoColapso(
                        envios,
                        aeropuertos,
                        planes,
                        diasExtra,
                        params,
                        1L
                    );
    
                envios = ventana.enviosVentana;
                diaMin = ventana.diaMin;
                diaMax = ventana.diaMax;
    
                log.info(
                    "[SIM:{}] Collapse window resolved -> diaMin={}, diaMax={}, envios={}",
                    simulationId,
                    diaMin,
                    diaMax,
                    envios.size()
                );
            }
    
            // =========================
            // INSTANCIAR VUELOS
            // =========================
    
            long tInstancias = System.currentTimeMillis();
    
            List<Vuelo> vuelos =
                util.instanciarVuelosPorRango(
                    planes,
                    diaMin,
                    diaMax + Math.max(0, diasExtra)
                );

            List<FlightDayCancellationEntity> cancellations = cancellationRepository.findAll();
            java.util.Set<String> cancelledKeys = new java.util.HashSet<>();
            for (FlightDayCancellationEntity c : cancellations) {
                String dateStr = c.fechaCancelacion.format(DateTimeFormatter.BASIC_ISO_DATE);
                cancelledKeys.add(c.flightId + "_" + dateStr);
            }
            vuelos.removeIf(v -> cancelledKeys.contains(v.idPlan + "_" + v.fecha));
    
            log.info(
                "[SIM:{}] Instantiated {} flights in {} ms",
                simulationId,
                vuelos.size(),
                System.currentTimeMillis() - tInstancias
            );
    
            if (vuelos.isEmpty()) {
    
                log.warn(
                    "[SIM:{}] No flights available for selected range",
                    simulationId
                );
    
                registry.markFailed(
                    simulationId,
                    "No hay vuelos disponibles para la ventana."
                );
    
                return;
            }
    
            // =========================
            // EJECUTAR GA
            // =========================
    
            long tGa = System.currentTimeMillis();
    
            GrafoVuelos grafo =
                new GrafoVuelos(vuelos, aeropuertos);
    
            PlanificadorGa planificador =
                new PlanificadorGa(
                    grafo,
                    envios,
                    params,
                    1L
                );
    
            Individuo mejor = planificador.ejecutar();
    
            log.info(
                "[SIM:{}] Genetic algorithm finished in {} ms",
                simulationId,
                System.currentTimeMillis() - tGa
            );
    
            // =========================
            // REPORTE
            // =========================
    
            if (Boolean.TRUE.equals(request.reporte)) {
    
                log.info(
                    "[SIM:{}] Generating report",
                    simulationId
                );
    
                try {
                    ReporteSinRuta.escribirReporte(
                        Path.of(raiz),
                        envios,
                        mejor,
                        "GA"
                    );
    
                    ReporteRutas.escribirReporte(Path.of(raiz), envios, mejor, "GA_full");
                } catch (Exception e) {
                    log.warn(
                        "[SIM:{}] Report generation failed; continuing simulation without report",
                        simulationId,
                        e
                    );
                }
            }
    
            // =========================
            // RESULTADOS
            // =========================
    
            long totalMaletas =
                envios.stream()
                    .mapToLong(e -> e.cantidad)
                    .sum();
    
            List<FlightSegmentDto> segmentos =
                construirSegmentos(
                    mejor,
                    envios,
                    aeropuertos
                );

            List<WarehouseStatusDto> almacenes =
                construirEventosAlmacen(
                    mejor,
                    envios,
                    aeropuertos
                );
    
            Map<String, RespuestaRutaEnvioDto> rutasPorPaquete =
                construirRutasPorPaquete(mejor, envios);

            SimulationData data =
                construirSimulationData(
                    request,
                    envios,
                    segmentos,
                    almacenes,
                    rutasPorPaquete,
                    totalMaletas,
                    diaMin,
                    diaMax,
                    diasExtra
                );

            SimulationRunEntity stored = simulationRunRepository.findBySimulationId(simulationId);
            if (stored != null) {
                stored.estado = SimulationState.Status.READY.name();
                stored.totalEnvios = envios.size();
                stored.totalMaletas = totalMaletas;
                stored.inicio = data.inicio;
                stored.fin = data.fin;
                stored.finalizadoEn = LocalDateTime.now();
                simulationRunRepository.save(stored);
            }
    
            registry.markReady(simulationId, data);
    
            log.info(
                "[SIM:{}] Simulation completed successfully in {} ms",
                simulationId,
                System.currentTimeMillis() - simulationStart
            );
    
        } catch (Exception ex) {
    
            log.error(
                "[SIM:{}] Simulation failed",
                simulationId,
                ex
            );
    
            registry.markFailed(
                simulationId,
                ex.getMessage()
            );
        }
    }

    private void ejecutarColapsoIncremental(String simulationId, SimulationRequest request) {
        long simulationStart = System.currentTimeMillis();
        try {
            log.info("[SIM:{}] Incremental collapse simulation started", simulationId);

            String raiz = System.getProperty("user.dir");
            UtilArchivos util = new UtilArchivos();

            String archivoEnvios = resolverArchivoEnvios(request);
            Path rutaEnvios = RutaResolver.resolverRutaData(raiz, archivoEnvios);
            Map<String, Aeropuerto> aeropuertos = cargarAeropuertosDb();

            log.info(
                "[SIM:{}] collapse inputs -> archivoEnvios={} airports={}",
                simulationId,
                archivoEnvios,
                aeropuertos.size()
            );

            if (aeropuertos.isEmpty()) {
                registry.markFailed(simulationId, "No hay aeropuertos registrados en la base de datos.");
                return;
            }

            List<Vuelo> planes = cargarVuelosDb(aeropuertos.keySet());
            log.info("[SIM:{}] collapse flight plans loaded={}", simulationId, planes.size());
            if (planes.isEmpty()) {
                registry.markFailed(simulationId, "No hay vuelos base disponibles para la simulación.");
                return;
            }

            int blockDays = (request.bloqueDias != null && request.bloqueDias > 0) ? request.bloqueDias : 5;
            int intervalMs = (request.intervaloPlanMs != null && request.intervaloPlanMs > 0) ? request.intervaloPlanMs : 180_000;
            LocalDate startDate = LocalDate.parse(request.inicio, FECHA_FORMAT);
            int blockIndex = 0;
            boolean firstBlock = true;
            SimulationData accumulated = null;

            while (true) {
                LocalDate blockStart = startDate.plusDays((long) blockIndex * blockDays);
                LocalDate blockEnd = blockStart.plusDays(blockDays - 1L);
                String blockStartText = blockStart.format(FECHA_FORMAT);
                String blockEndText = blockEnd.format(FECHA_FORMAT);

                log.info(
                    "[SIM:{}] collapse block start index={} range={}..{}",
                    simulationId,
                    blockIndex,
                    blockStartText,
                    blockEndText
                );

                List<Envio> envios = util.cargarEnvios(
                    rutaEnvios,
                    aeropuertos.keySet(),
                    aeropuertos,
                    blockStartText,
                    blockEndText
                );
                envios = limitarEnvios(request, envios);

                log.info(
                    "[SIM:{}] collapse block shipments={}",
                    simulationId,
                    envios.size()
                );

                if (envios.isEmpty()) {
                    if (firstBlock) {
                        registry.markFailed(simulationId, "No hay envíos para el rango inicial de colapso.");
                    } else {
                        registry.markCompleted(simulationId, "Simulación hasta el colapso finalizada: no hay más envíos para planificar.");
                    }
                    actualizarRunFinal(simulationId, firstBlock ? SimulationState.Status.FAILED.name() : SimulationState.Status.COMPLETED.name(), accumulated);
                    return;
                }

                ChunkResult chunk = planificarChunk(request, util, envios, aeropuertos, planes, blockStartText, blockEndText);
                if (chunk == null) {
                    registry.markFailed(simulationId, "No fue posible calcular el bloque incremental de colapso.");
                    actualizarRunFinal(simulationId, SimulationState.Status.FAILED.name(), accumulated);
                    return;
                }

                if (firstBlock) {
                    accumulated = chunk.data;
                    registry.markReady(simulationId, accumulated);
                    firstBlock = false;
                } else {
                    registry.appendData(simulationId, chunk.data);
                    SimulationState state = registry.get(simulationId);
                    if (state != null && state.data != null) {
                        accumulated = state.data;
                    }
                }

                actualizarRunIntermedio(simulationId, accumulated, chunk);

                if (!chunk.factible) {
                    long totalEnviosAcumulados = accumulated != null ? accumulated.totalEnvios : chunk.data.totalEnvios;
                    long totalMaletasAcumuladas = accumulated != null ? accumulated.totalMaletas : chunk.data.totalMaletas;
                    String message = String.format(
                        "Colapso detectado en el bloque %s..%s (envíos=%d, maletas=%d).",
                        blockStartText,
                        blockEndText,
                        totalEnviosAcumulados,
                        totalMaletasAcumuladas
                    );
                    registry.markCompleted(simulationId, message);
                    actualizarRunFinal(simulationId, SimulationState.Status.COMPLETED.name(), accumulated);
                    log.info("[SIM:{}] collapse finished because chunk became infeasible", simulationId);
                    return;
                }

                blockIndex++;
                if (intervalMs > 0) {
                    log.info("[SIM:{}] collapse waiting {} ms before next block", simulationId, intervalMs);
                    Thread.sleep(intervalMs);
                }
            }
        } catch (Exception ex) {
            log.error("[SIM:{}] Incremental collapse simulation failed", simulationId, ex);
            registry.markFailed(simulationId, ex.getMessage());
            actualizarRunFinal(simulationId, SimulationState.Status.FAILED.name(), null);
        } finally {
            log.info("[SIM:{}] Incremental collapse simulation finished in {} ms", simulationId, System.currentTimeMillis() - simulationStart);
        }
    }

    public void refreshActiveSimulations(String triggerType, String detail) {
        for (String simulationId : registry.getSimulationIds()) {
            SimulationState state = registry.get(simulationId);
            if (state == null || state.data == null || state.request == null) {
                continue;
            }
            if (state.status != SimulationState.Status.READY && state.status != SimulationState.Status.PAUSED) {
                continue;
            }
            boolean wasPaused = state.status == SimulationState.Status.PAUSED;
            state.startPausedAfterReady = wasPaused;
            log.info(
                "[SIM:{}] refresh requested triggerType={} detail={} wasPaused={}",
                simulationId,
                triggerType,
                detail,
                wasPaused
            );
            registry.pauseSimulation(simulationId);
            registry.markRunning(simulationId, "Recalculando por " + triggerType);
            SimulationRequest request = state.request;
            executor.submit(() -> {
                try {
                    ejecutar(simulationId, request);
                    if (wasPaused) {
                        registry.pauseSimulation(simulationId);
                    }
                } catch (Exception ex) {
                    log.error("[SIM:{}] refresh failed triggerType={} detail={}", simulationId, triggerType, detail, ex);
                }
            });
        }
    }

    private ChunkResult planificarChunk(
        SimulationRequest request,
        UtilArchivos util,
        List<Envio> envios,
        Map<String, Aeropuerto> aeropuertos,
        List<Vuelo> planes,
        String blockStartText,
        String blockEndText
    ) {
        try {
            int diaMin = envios.stream().mapToInt(e -> e.diaIndex).min().orElse(0);
            int diaMax = envios.stream().mapToInt(e -> e.diaIndex).max().orElse(diaMin);
            int maxSlaHoras = envios.stream().mapToInt(e -> e.slaHoras).max().orElse(0);
            int diasExtra = resolverDiasExtra(request, maxSlaHoras);

            List<Vuelo> vuelos = util.instanciarVuelosPorRango(planes, diaMin, diaMax + Math.max(0, diasExtra));
            List<FlightDayCancellationEntity> cancellations = cancellationRepository.findAll();
            java.util.Set<String> cancelledKeys = new java.util.HashSet<>();
            for (FlightDayCancellationEntity c : cancellations) {
                String dateStr = c.fechaCancelacion.format(DateTimeFormatter.BASIC_ISO_DATE);
                cancelledKeys.add(c.flightId + "_" + dateStr);
            }
            vuelos.removeIf(v -> cancelledKeys.contains(v.idPlan + "_" + v.fecha));

            log.info(
                "[SIM:chunk] range={}..{} diaMin={} diaMax={} diasExtra={} vuelos={}",
                blockStartText,
                blockEndText,
                diaMin,
                diaMax,
                diasExtra,
                vuelos.size()
            );

            if (vuelos.isEmpty()) {
                return null;
            }

            ParametrosGa params = construirParametros(request);
            GrafoVuelos grafo = new GrafoVuelos(vuelos, aeropuertos);
            Individuo mejor = new PlanificadorGa(grafo, envios, params, 1L).ejecutar();
            log.info(
                "[SIM:chunk] result range={}..{} fitness={} factible={}",
                blockStartText,
                blockEndText,
                mejor != null ? mejor.fitness : null,
                mejor != null && mejor.esFactible()
            );

            List<FlightSegmentDto> segmentos = construirSegmentos(mejor, envios, aeropuertos);
            List<WarehouseStatusDto> almacenes = construirEventosAlmacen(mejor, envios, aeropuertos);
            Map<String, RespuestaRutaEnvioDto> rutasPorPaquete = construirRutasPorPaquete(mejor, envios);
            long totalMaletas = envios.stream().mapToLong(e -> e.cantidad).sum();

            if (!segmentos.isEmpty()) {
                String resumen = segmentos.stream()
                    .limit(5)
                    .map(seg -> seg.flightId + ":" + seg.origen + "->" + seg.destino)
                    .reduce((a, b) -> a + " | " + b)
                    .orElse("-");
                log.info("[SIM:chunk] sample segments {}", resumen);
            }

            SimulationData data = construirSimulationData(
                request,
                envios,
                segmentos,
                almacenes,
                rutasPorPaquete,
                totalMaletas,
                diaMin,
                diaMax,
                diasExtra
            );

            return new ChunkResult(data, mejor != null && mejor.esFactible(), diaMin, diaMax, totalMaletas);
        } catch (Exception ex) {
            log.error("[SIM:chunk] failed range={}..{}", blockStartText, blockEndText, ex);
            return null;
        }
    }

    private void actualizarRunIntermedio(String simulationId, SimulationData data, ChunkResult chunk) {
        SimulationRunEntity stored = simulationRunRepository.findBySimulationId(simulationId);
        if (stored == null || data == null || chunk == null) {
            return;
        }
        stored.totalEnvios = data.totalEnvios;
        stored.totalMaletas = data.totalMaletas;
        stored.inicio = data.inicio;
        stored.fin = data.fin;
        stored.estado = chunk.factible ? SimulationState.Status.READY.name() : SimulationState.Status.COMPLETED.name();
        simulationRunRepository.save(stored);
    }

    private void actualizarRunFinal(String simulationId, String estado, SimulationData data) {
        SimulationRunEntity stored = simulationRunRepository.findBySimulationId(simulationId);
        if (stored == null) {
            return;
        }
        stored.estado = estado;
        stored.finalizadoEn = LocalDateTime.now();
        if (data != null) {
            stored.totalEnvios = data.totalEnvios;
            stored.totalMaletas = data.totalMaletas;
            stored.inicio = data.inicio;
            stored.fin = data.fin;
        }
        simulationRunRepository.save(stored);
    }

    private static class ChunkResult {
        final SimulationData data;
        final boolean factible;
        final int diaMin;
        final int diaMax;
        final long totalMaletas;

        ChunkResult(SimulationData data, boolean factible, int diaMin, int diaMax, long totalMaletas) {
            this.data = data;
            this.factible = factible;
            this.diaMin = diaMin;
            this.diaMax = diaMax;
            this.totalMaletas = totalMaletas;
        }
    }

    private ParametrosGa construirParametros(SimulationRequest request) {
        ParametrosGa params = new ParametrosGa();
        params.tamanoPoblacion = (request.poblacion != null) ? request.poblacion : DEFAULT_POBLACION;
        params.maxGeneraciones = (request.generaciones != null) ? request.generaciones : DEFAULT_GENERACIONES;
        params.tasaCruce = (request.cruce != null) ? request.cruce : DEFAULT_CRUCE;
        params.tasaMutacion = (request.mutacion != null) ? request.mutacion : DEFAULT_MUTACION;
        params.tamanoTorneo = (request.torneo != null) ? request.torneo : DEFAULT_TORNEO;
        params.evaluacionParalela = request.paralelo == null || request.paralelo;
        params.maxHilosEvaluacion = (request.hilos != null && request.hilos > 0)
            ? request.hilos
            : Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
        params.maxTiempoMs = (request.maxTiempoMs != null && request.maxTiempoMs > 0)
            ? request.maxTiempoMs
            : 0L;
        params.maxGeneracionesSinMejora = (request.estancamiento != null && request.estancamiento > 0)
            ? request.estancamiento
            : 0;
        ObjetivoConfig.aplicar(params);
        return params;
    }

    private List<FlightSegmentDto> construirSegmentos(Individuo mejor, List<Envio> envios, Map<String, Aeropuerto> aeropuertos) {
        Map<Integer, FlightSegmentDto> mapa = new HashMap<>();
        if (mejor == null || mejor.asignaciones == null) {
            return List.of();
        }

        for (int i = 0; i < envios.size(); i++) {
            Ruta ruta = mejor.asignaciones[i];
            if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) {
                continue;
            }
            for (Vuelo vuelo : ruta.vuelos) {
                FlightSegmentDto seg = mapa.get(vuelo.id);
                if (seg == null) {
                    seg = new FlightSegmentDto();
                    seg.flightId = vuelo.id;
                    seg.planId = vuelo.idPlan;
                    seg.origen = vuelo.origen;
                    seg.destino = vuelo.destino;
                    seg.salidaMin = vuelo.salidaMin;
                    seg.llegadaMin = vuelo.llegadaMin;
                    seg.capacidad = vuelo.capacidad;
                    Aeropuerto aO = aeropuertos.get(vuelo.origen);
                    Aeropuerto aD = aeropuertos.get(vuelo.destino);
                    if (aO != null) {
                        seg.origenLat = aO.latitud;
                        seg.origenLon = aO.longitud;
                    }
                    if (aD != null) {
                        seg.destinoLat = aD.latitud;
                        seg.destinoLon = aD.longitud;
                    }
                    mapa.put(vuelo.id, seg);
                }
                seg.carga += envios.get(i).cantidad;
            }
        }

        return new ArrayList<>(mapa.values());
    }

    private Map<String, RespuestaRutaEnvioDto> construirRutasPorPaquete(Individuo mejor, List<Envio> envios) {
        Map<String, RespuestaRutaEnvioDto> mapa = new HashMap<>();
        if (mejor == null || mejor.asignaciones == null) {
            return mapa;
        }

        for (int i = 0; i < envios.size(); i++) {
            Envio envio = envios.get(i);
            Ruta ruta = mejor.asignaciones[i];
            RespuestaRutaEnvioDto dto = new RespuestaRutaEnvioDto();
            dto.codigoPedido = envio.idPedido;

            if (ruta != null && ruta.vuelos != null && !ruta.vuelos.isEmpty()) {
                dto.estado = (ruta.tiempoTotalHoras > envio.slaHoras) ? "CON_RETRASO" : "ENTREGADO";
                dto.tiempoTotalHoras = ruta.tiempoTotalHoras;
                dto.ruta = new ArrayList<>();
                for (Vuelo v : ruta.vuelos) {
                    PasoRutaDto paso = new PasoRutaDto();
                    paso.vueloId = v.id; paso.origen = v.origen; paso.destino = v.destino;
                    paso.salidaMin = v.salidaMin; paso.llegadaMin = v.llegadaMin;
                    dto.ruta.add(paso);
                }
            } else {
                dto.estado = "SIN_RUTA_ENCONTRADA"; dto.tiempoTotalHoras = 0.0; dto.ruta = new ArrayList<>();
            }
            mapa.put(envio.idPedido, dto);
        }
        return mapa;
    }

    private Map<String, Aeropuerto> cargarAeropuertosDb() {
        Map<String, Aeropuerto> resultado = new HashMap<>();
        List<AirportEntity> entities = airportRepository.findAll();
        for (AirportEntity entity : entities) {
            if (entity.codigoOaci == null || entity.codigoOaci.isBlank()) {
                continue;
            }
            String codigo = entity.codigoOaci.trim().toUpperCase();
            String codigoCorto = codigo.toLowerCase();
            String continente = (entity.continente == null || entity.continente.isBlank())
                ? UtilArchivos.obtenerContinente(codigo)
                : entity.continente.trim();

            Aeropuerto aeropuerto = new Aeropuerto(
                codigo,
                entity.nombre,
                entity.pais,
                codigoCorto,
                entity.gmt,
                entity.capacidad,
                entity.latitud,
                entity.longitud,
                continente
            );
            resultado.put(codigo, aeropuerto);
        }
        return resultado;
    }

    private List<Vuelo> cargarVuelosDb(java.util.Set<String> oaciValidos) {
        List<Vuelo> planes = new ArrayList<>();
        List<FlightEntity> entities = flightRepository.findAll();
        int id = 0;
        for (FlightEntity entity : entities) {
            if (entity.cancelado) {
                continue;
            }
            if (entity.origen == null || entity.destino == null || entity.salida == null || entity.llegada == null) {
                continue;
            }
            String origen = entity.origen.codigoOaci;
            String destino = entity.destino.codigoOaci;
            if (origen == null || destino == null) {
                continue;
            }
            origen = origen.trim().toUpperCase();
            destino = destino.trim().toUpperCase();
            if (!oaciValidos.contains(origen) || !oaciValidos.contains(destino)) {
                continue;
            }
            int salidaMin = entity.salida.getHour() * 60 + entity.salida.getMinute();
            int llegadaMin = entity.llegada.getHour() * 60 + entity.llegada.getMinute();
            int capacidad = entity.capacidad;
            int planId = entity.id != null ? entity.id.intValue() : id;

            planes.add(new Vuelo(id++, origen, destino, salidaMin, llegadaMin, capacidad, -1, null, planId));
        }
        return planes;
    }

    private List<WarehouseStatusDto> construirEventosAlmacen(
        Individuo mejor,
        List<Envio> envios,
        Map<String, Aeropuerto> aeropuertos
    ) {

        Map<String, List<WarehouseEventDto>> eventos = new HashMap<>();
        if (mejor == null || mejor.asignaciones == null) {
            return List.of();
        }

        for (int i = 0; i < envios.size(); i++) {
            Envio envio = envios.get(i);
            Ruta ruta = mejor.asignaciones[i];
            if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) {
                continue;
            }
            for (int j = 0; j < ruta.vuelos.size(); j++) {
                int llegada = ruta.llegadasAlmacenMin[j];
                int salida = ruta.salidasAlmacenMin[j];
                if (salida <= llegada) {
                    continue;
                }
                Vuelo vuelo = ruta.vuelos.get(j);
                List<WarehouseEventDto> lista = eventos.computeIfAbsent(
                    vuelo.destino,
                    k -> new ArrayList<>()
                );

                WarehouseEventDto in = new WarehouseEventDto();
                in.minuto = llegada;
                in.delta = envio.cantidad;
                lista.add(in);

                WarehouseEventDto out = new WarehouseEventDto();
                out.minuto = salida;
                out.delta = -envio.cantidad;
                lista.add(out);
            }
        }

        List<WarehouseStatusDto> result = new ArrayList<>();
        for (Aeropuerto aeropuerto : aeropuertos.values()) {
            List<WarehouseEventDto> lista = eventos.getOrDefault(aeropuerto.codigoOaci, new ArrayList<>());
            lista.sort(java.util.Comparator.comparingInt(a -> a.minuto));
            WarehouseStatusDto dto = new WarehouseStatusDto();
            dto.codigoOaci = aeropuerto.codigoOaci;
            dto.capacidad = aeropuerto.capacidad;
            dto.eventos = lista;
            result.add(dto);
        }

        return result;
    }

    private String calcularFinDesdeInicio(String inicio, int dias) {
        LocalDate d = LocalDate.parse(inicio, FECHA_FORMAT);
        int delta = Math.max(1, dias) - 1;
        return d.plusDays(delta).format(FECHA_FORMAT);
    }

    private String resolverArchivoEnvios(SimulationRequest request) {

        if (request.envios == null || request.envios.isBlank()) {
            return "_envios_preliminar_";
        }
    
        return request.envios;
    }

    private String resolverFechaFin(SimulationRequest request) {

        String fin = request.fin;
    
        if ((fin == null || fin.isBlank())
            && request.dias != null
            && request.inicio != null) {
    
            return calcularFinDesdeInicio(
                request.inicio,
                request.dias
            );
        }
    
        return fin;
    }

    private List<Envio> limitarEnvios(
        SimulationRequest request,
        List<Envio> envios
    ) {
    
        Integer maxEnvios = request.maxEnvios;
    
        if (maxEnvios == null || maxEnvios <= 0) {
            return envios;
        }
    
        if (envios.size() <= maxEnvios) {
            return envios;
        }
    
        return new ArrayList<>(
            envios.subList(0, maxEnvios)
        );
    }

    private int resolverDiasExtra(
        SimulationRequest request,
        int maxSlaHoras
    ) {
    
        if (request.diasExtra != null
            && request.diasExtra >= 0) {
    
            return request.diasExtra;
        }
    
        return (int) Math.ceil(maxSlaHoras / 24.0);
    }

    private SimulationData construirSimulationData(
        SimulationRequest request,
        List<Envio> envios,
        List<FlightSegmentDto> segmentos,
        List<WarehouseStatusDto> almacenes,
        Map<String, RespuestaRutaEnvioDto> rutasPorPaquete,
        long totalMaletas,
        int diaMin,
        int diaMax,
        int diasExtra
    ) {
    
        String inicioFinal =
            UtilArchivos.formatearFecha(diaMin);
    
        String finFinal =
            UtilArchivos.formatearFecha(diaMax);
    
        double speed =
            (request.speedMinPerSec != null
                && request.speedMinPerSec > 0)
                ? request.speedMinPerSec
                : DEFAULT_SPEED_MIN_PER_SEC;
    
        java.util.Map<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> enviosPorCodigo =
            envios.stream()
                .collect(java.util.stream.Collectors.toMap(
                    e -> e.idPedido,
                    this::toShipmentDto,
                    (left, right) -> left,
                    java.util.LinkedHashMap::new
                ));

        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> enviosPorVuelo =
            buildShipmentsByFlight(rutasPorPaquete, enviosPorCodigo);

        log.info(
            "[SIM][BUILD] shipments index built enviosPorCodigo={} enviosPorVuelo={} routes={}",
            enviosPorCodigo.size(),
            enviosPorVuelo.size(),
            rutasPorPaquete != null ? rutasPorPaquete.size() : 0
        );

        return new SimulationData(
            inicioFinal,
            finFinal,
            diaMin,
            diaMax,
            diasExtra,
            envios.size(),
            totalMaletas,
            speed,
            segmentos,
            almacenes,
            rutasPorPaquete,
            enviosPorCodigo,
            enviosPorVuelo
        );
    }
}
