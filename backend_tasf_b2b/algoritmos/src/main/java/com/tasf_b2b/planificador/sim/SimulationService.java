package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.WarehouseEventDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;
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
    private static final double DEFAULT_SPEED_MIN_PER_SEC = 5.0;
    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    private final SimulationRegistry registry;
    private final SimulationRunRepository simulationRunRepository;
    private final AirportRepository airportRepository;
    private final FlightRepository flightRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public SimulationService(
        SimulationRegistry registry,
        SimulationRunRepository simulationRunRepository,
        AirportRepository airportRepository,
        FlightRepository flightRepository
    ) {
        this.registry = registry;
        this.simulationRunRepository = simulationRunRepository;
        this.airportRepository = airportRepository;
        this.flightRepository = flightRepository;
    }

    public SimulationResponse startSimulation(SimulationRequest request) {
        String simulationId = UUID.randomUUID().toString();
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
        response.message = "RUNNING";
        // de momento, para que siempre genere reporte en el back
        request.reporte = true;

        SimulationRunEntity run = new SimulationRunEntity();
        run.simulationId = simulationId;
        run.tipo = (request.buscarColapso != null && request.buscarColapso) ? "COLAPSO" : "PERIODO";
        run.inicio = request.inicio;
        run.fin = response.fin;
        run.dias = request.dias;
        run.estado = SimulationState.Status.RUNNING.name();
        run.speedMinPerSec = response.speedMinPerSec;
        run.creadoEn = LocalDateTime.now();
        simulationRunRepository.save(run);

        registry.create(simulationId);

        executor.submit(() -> ejecutar(simulationId, request));
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
    
            SimulationData data =
                construirSimulationData(
                    request,
                    envios,
                    segmentos,
                    almacenes,
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
            almacenes
        );
    }
}
