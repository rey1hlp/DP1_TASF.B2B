package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
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
import com.tasf_b2b.planificador.utils.ReporteSinRuta;
import com.tasf_b2b.planificador.utils.RutaResolver;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
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

    private final SimulationRegistry registry;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public SimulationService(SimulationRegistry registry) {
        this.registry = registry;
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

        registry.create(simulationId);

        executor.submit(() -> ejecutar(simulationId, request));
        return response;
    }

    private void ejecutar(String simulationId, SimulationRequest request) {
        try {
            String raiz = System.getProperty("user.dir");
            UtilArchivos util = new UtilArchivos();

            String archivoEnvios = (request.envios == null || request.envios.isBlank())
                ? "_envios_preliminar_"
                : request.envios;

            String inicio = request.inicio;
            String fin = request.fin;
            if ((fin == null || fin.isBlank()) && request.dias != null && inicio != null) {
                fin = calcularFinDesdeInicio(inicio, request.dias);
            }

            Path rutaAeropuertosTxt = RutaResolver.resolverRutaData(raiz, "aeropuertos.txt");
            Path rutaAeropuertosCsv = RutaResolver.resolverRutaData(raiz, "aeropuertos.csv");
            Path rutaVuelos = RutaResolver.resolverRutaData(raiz, "planes_vuelo.txt");
            Path rutaEnvios = RutaResolver.resolverRutaData(raiz, archivoEnvios);

            Map<String, Aeropuerto> aeropuertos = util.cargarAeropuertos(rutaAeropuertosTxt, rutaAeropuertosCsv);

            if (Files.isDirectory(rutaEnvios)) {
                // noop, solo para confirmar existencia
            }

            List<Envio> envios = util.cargarEnvios(rutaEnvios, aeropuertos.keySet(), aeropuertos, inicio, fin);
            if (request.maxEnvios != null && request.maxEnvios > 0 && envios.size() > request.maxEnvios) {
                envios = new ArrayList<>(envios.subList(0, request.maxEnvios));
            }

            if (envios.isEmpty()) {
                registry.markFailed(simulationId, "No hay envios en la ventana solicitada.");
                return;
            }

            int diaMin = envios.stream().mapToInt(e -> e.diaIndex).min().orElse(0);
            int diaMax = envios.stream().mapToInt(e -> e.diaIndex).max().orElse(diaMin);
            int maxSlaHoras = envios.stream().mapToInt(e -> e.slaHoras).max().orElse(0);
            int diasExtra = (request.diasExtra != null && request.diasExtra >= 0)
                ? request.diasExtra
                : (int) Math.ceil(maxSlaHoras / 24.0);

            List<Vuelo> planes = util.cargarVuelos(rutaVuelos, aeropuertos.keySet());
            ParametrosGa params = construirParametros(request);

            if (Boolean.TRUE.equals(request.buscarColapso)) {
                BuscadorColapso.ResultadoVentana ventana = BuscadorColapso.buscarPuntoColapso(
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
            }

            List<Vuelo> vuelos = util.instanciarVuelosPorRango(planes, diaMin, diaMax + Math.max(0, diasExtra));
            if (vuelos.isEmpty()) {
                registry.markFailed(simulationId, "No hay vuelos disponibles para la ventana.");
                return;
            }

            GrafoVuelos grafo = new GrafoVuelos(vuelos, aeropuertos);
            PlanificadorGa planificador = new PlanificadorGa(grafo, envios, params, 1L);
            Individuo mejor = planificador.ejecutar();

            if (Boolean.TRUE.equals(request.reporte)) {
                ReporteSinRuta.escribirReporte(Path.of(raiz), envios, mejor, "GA");
            }

            long totalMaletas = envios.stream().mapToLong(e -> e.cantidad).sum();
            List<FlightSegmentDto> segmentos = construirSegmentos(mejor, envios, aeropuertos);

            String inicioFinal = UtilArchivos.formatearFecha(diaMin);
            String finFinal = UtilArchivos.formatearFecha(diaMax);
            double speed = (request.speedMinPerSec != null && request.speedMinPerSec > 0)
                ? request.speedMinPerSec
                : DEFAULT_SPEED_MIN_PER_SEC;

            SimulationData data = new SimulationData(
                inicioFinal,
                finFinal,
                diaMin,
                diaMax,
                diasExtra,
                envios.size(),
                totalMaletas,
                speed,
                segmentos
            );

            registry.markReady(simulationId, data);
        } catch (Exception ex) {
            registry.markFailed(simulationId, ex.getMessage());
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

    private String calcularFinDesdeInicio(String inicio, int dias) {
        LocalDate d = LocalDate.parse(inicio, FECHA_FORMAT);
        int delta = Math.max(1, dias) - 1;
        return d.plusDays(delta).format(FECHA_FORMAT);
    }
}
