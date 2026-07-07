package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.PasoRutaDto;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;
import com.tasf_b2b.planificador.nucleo.GrafoVuelos;
import com.tasf_b2b.planificador.nucleo.Individuo;
import com.tasf_b2b.planificador.nucleo.ObjetivoConfig;
import com.tasf_b2b.planificador.nucleo.ParametrosGa;
import com.tasf_b2b.planificador.nucleo.PlanificadorGa;
import com.tasf_b2b.planificador.nucleo.Ruta;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import com.tasf_b2b.planificador.persistence.DailyPlanRunEntity;
import com.tasf_b2b.planificador.persistence.DailyPlanRunRepository;
import com.tasf_b2b.planificador.persistence.DailyPlanSegmentEntity;
import com.tasf_b2b.planificador.persistence.DailyPlanSegmentRepository;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationEntity;
import com.tasf_b2b.planificador.persistence.FlightDayCancellationRepository;
import com.tasf_b2b.planificador.persistence.FlightEntity;
import com.tasf_b2b.planificador.persistence.FlightRepository;
import com.tasf_b2b.planificador.persistence.ShipmentEntity;
import com.tasf_b2b.planificador.persistence.ShipmentRepository;
import com.tasf_b2b.planificador.persistence.ShipmentStatus;
import com.tasf_b2b.planificador.utils.BagCodeResolver;
import com.tasf_b2b.planificador.utils.UtilArchivos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
public class DailyPlanningService {
    private static final Logger log = LoggerFactory.getLogger(DailyPlanningService.class);
    private static final ZoneId ZONE = ZoneId.of("America/Lima");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final int WINDOW_SIZE_MIN = 70;
    private static final int WINDOW_STEP_MIN = 20;
    private static final int DEFAULT_POBLACION = 30;
    private static final int DEFAULT_GENERACIONES = 60;
    private static final double DEFAULT_CRUCE = 0.85;
    private static final double DEFAULT_MUTACION = 0.05;
    private static final int DEFAULT_TORNEO = 5;

    private final AirportRepository airportRepository;
    private final FlightRepository flightRepository;
    private final FlightDayCancellationRepository cancellationRepository;
    private final ShipmentRepository shipmentRepository;
    private final DailyPlanRunRepository planRunRepository;
    private final DailyPlanSegmentRepository planSegmentRepository;
    private final UtilArchivos util = new UtilArchivos();
    private final AtomicBoolean planning = new AtomicBoolean(false);
    private volatile Map<String, RespuestaRutaEnvioDto> lastRutasPorPaquete = new ConcurrentHashMap<>();

    public DailyPlanningService(
        AirportRepository airportRepository,
        FlightRepository flightRepository,
        FlightDayCancellationRepository cancellationRepository,
        ShipmentRepository shipmentRepository,
        DailyPlanRunRepository planRunRepository,
        DailyPlanSegmentRepository planSegmentRepository
    ) {
        this.airportRepository = airportRepository;
        this.flightRepository = flightRepository;
        this.cancellationRepository = cancellationRepository;
        this.shipmentRepository = shipmentRepository;
        this.planRunRepository = planRunRepository;
        this.planSegmentRepository = planSegmentRepository;
    }

    public List<FlightSegmentDto> getCurrentPlanSegments() {
        PlanWindow window = resolveCurrentWindow(false);
        log.info(
            "[DAILY_PLAN] getCurrentPlanSegments date={} window={}..{}",
            window.planDate,
            window.windowStartMin,
            window.windowEndMin
        );
        DailyPlanRunEntity existing = planRunRepository.findLatestCoveringMinute(window.planDate, window.windowStartMin);
        log.info(
            "[DAILY_PLAN] existing covering run={}",
            existing != null
                ? ("id=" + existing.id + ", start=" + existing.windowStartMin + ", end=" + existing.windowEndMin + ", trigger=" + existing.triggerType)
                : "none"
        );
        if (existing == null) {
            log.info("[DAILY_PLAN] no existing run found, building initial plan");
            existing = buildAndStorePlan(resolveCurrentWindow(true), "SCHEDULED", "initial");
        }
        if (existing == null) {
            log.warn("[DAILY_PLAN] getCurrentPlanSegments could not build or find a run");
            return List.of();
        }
        return loadSegments(existing.id);
    }

    public void replanNow(String triggerType, String detail) {
        PlanWindow window = resolveCurrentWindow(false);
        log.info(
            "[DAILY_PLAN] replanNow triggerType={} detail={} date={} window={}..{}",
            triggerType,
            detail,
            window.planDate,
            window.windowStartMin,
            window.windowEndMin
        );
        buildAndStorePlan(window, triggerType, detail);
    }

    @Scheduled(fixedRate = 60_000L)
    public void ensureScheduledPlan() {
        PlanWindow window = resolveCurrentWindow(false);
        DailyPlanRunEntity latest = planRunRepository.findTopByPlanDateOrderByCreatedAtDesc(window.planDate);
        log.info(
            "[DAILY_PLAN] scheduled tick date={} nowWindow={}..{} latestRun={}",
            window.planDate,
            window.windowStartMin,
            window.windowEndMin,
            latest != null
                ? ("id=" + latest.id + ", start=" + latest.windowStartMin + ", end=" + latest.windowEndMin + ", createdAt=" + latest.createdAt)
                : "none"
        );
        if (latest == null || minutesSince(latest.windowStartMin, window.windowStartMin) >= WINDOW_STEP_MIN) {
            log.info("[DAILY_PLAN] scheduled tick will build a new plan");
            buildAndStorePlan(window, "SCHEDULED", "tick");
        } else {
            log.info(
                "[DAILY_PLAN] scheduled tick skipped, only {} min since last window start",
                minutesSince(latest.windowStartMin, window.windowStartMin)
            );
        }
    }

    private DailyPlanRunEntity buildAndStorePlan(PlanWindow window, String triggerType, String detail) {
        if (!planning.compareAndSet(false, true)) {
            log.warn(
                "[DAILY_PLAN] build skipped because another planning execution is active date={} window={}..{} triggerType={} detail={}",
                window.planDate,
                window.windowStartMin,
                window.windowEndMin,
                triggerType,
                detail
            );
            return planRunRepository
                .findTopByPlanDateAndWindowStartMinOrderByCreatedAtDesc(window.planDate, window.windowStartMin);
        }

        try {
            log.info(
                "[DAILY_PLAN] build started date={} window={}..{} triggerType={} detail={}",
                window.planDate,
                window.windowStartMin,
                window.windowEndMin,
                triggerType,
                detail
            );
            Map<String, Aeropuerto> aeropuertos = cargarAeropuertosDb();
            log.info("[DAILY_PLAN] airports loaded={}", aeropuertos.size());
            if (aeropuertos.isEmpty()) {
                log.warn("[DAILY_PLAN] build aborted because there are no airports");
                return null;
            }

            List<Envio> envios = cargarEnviosDb(aeropuertos, window);
            log.info("[DAILY_PLAN] shipments selected for planning={}", envios.size());
            List<Vuelo> planes = cargarVuelosDb(aeropuertos.keySet());
            log.info("[DAILY_PLAN] flight plans loaded={}", planes.size());
            List<Vuelo> vuelos = instanciarVuelos(window, planes);
            log.info("[DAILY_PLAN] instantiated flights in date window={}", vuelos.size());
            if (!vuelos.isEmpty()) {
                removerCancelaciones(window, vuelos);
                log.info("[DAILY_PLAN] instantiated flights after cancellations={}", vuelos.size());
            }

            Individuo mejor = planificar(envios, aeropuertos, vuelos);
            log.info(
                "[DAILY_PLAN] planning result={}",
                mejor != null ? ("fitness=" + mejor.fitness + ", factible=" + mejor.esFactible()) : "null"
            );
            List<FlightSegmentDto> segmentos = construirSegmentos(mejor, envios, aeropuertos);
            log.info("[DAILY_PLAN] segments built={}", segmentos.size());

            this.lastRutasPorPaquete = construirRutasPorPaquete(mejor, envios);
            syncStatusesAfterPlan();

            DailyPlanRunEntity run = new DailyPlanRunEntity();
            run.planDate = window.planDate;
            run.windowStartMin = window.windowStartMin;
            run.windowEndMin = window.windowEndMin;
            run.triggerType = triggerType;
            run.triggerDetail = detail;
            run.totalEnvios = envios.size();
            run.totalMaletas = envios.stream().mapToLong(e -> e.cantidad).sum();
            run = planRunRepository.save(run);
            log.info(
                "[DAILY_PLAN] run saved id={} date={} window={}..{} triggerType={} detail={} totalEnvios={} totalMaletas={}",
                run.id,
                run.planDate,
                run.windowStartMin,
                run.windowEndMin,
                run.triggerType,
                run.triggerDetail,
                run.totalEnvios,
                run.totalMaletas
            );

            List<DailyPlanSegmentEntity> segmentEntities = new ArrayList<>();
            for (FlightSegmentDto segment : segmentos) {
                DailyPlanSegmentEntity entity = new DailyPlanSegmentEntity();
                entity.planRunId = run.id;
                entity.flightId = segment.flightId;
                entity.planId = segment.planId;
                entity.origen = segment.origen;
                entity.destino = segment.destino;
                entity.salidaMin = segment.salidaMin;
                entity.llegadaMin = segment.llegadaMin;
                entity.carga = segment.carga;
                entity.capacidad = segment.capacidad;
                entity.origenLat = segment.origenLat;
                entity.origenLon = segment.origenLon;
                entity.destinoLat = segment.destinoLat;
                entity.destinoLon = segment.destinoLon;
                segmentEntities.add(entity);
            }
            planSegmentRepository.saveAll(segmentEntities);
            log.info("[DAILY_PLAN] segment rows saved={}", segmentEntities.size());
            return run;
        } finally {
            log.info(
                "[DAILY_PLAN] build finished date={} window={}..{} triggerType={} detail={}",
                window.planDate,
                window.windowStartMin,
                window.windowEndMin,
                triggerType,
                detail
            );
            planning.set(false);
        }
    }

    private List<FlightSegmentDto> loadSegments(Long runId) {
        if (runId == null) {
            return List.of();
        }
        return planSegmentRepository.findByPlanRunId(runId).stream().map(entity -> {
            FlightSegmentDto dto = new FlightSegmentDto();
            dto.flightId = entity.flightId;
            dto.planId = entity.planId;
            dto.origen = entity.origen;
            dto.destino = entity.destino;
            dto.salidaMin = entity.salidaMin;
            dto.llegadaMin = entity.llegadaMin;
            dto.carga = entity.carga;
            dto.capacidad = entity.capacidad;
            dto.origenLat = entity.origenLat;
            dto.origenLon = entity.origenLon;
            dto.destinoLat = entity.destinoLat;
            dto.destinoLon = entity.destinoLon;
            return dto;
        }).collect(Collectors.toList());
    }

    private PlanWindow resolveCurrentWindow(boolean snapToStep) {
        OffsetDateTime now = OffsetDateTime.now(ZONE);
        int currentMinute = now.getHour() * 60 + now.getMinute();
        int windowStart = snapToStep ? (currentMinute / WINDOW_STEP_MIN) * WINDOW_STEP_MIN : currentMinute;
        int windowEnd = windowStart + WINDOW_SIZE_MIN;
        String planDate = now.toLocalDate().format(DATE_FORMAT);
        return new PlanWindow(planDate, windowStart, windowEnd);
    }

    private Map<String, Aeropuerto> cargarAeropuertosDb() {
        Map<String, Aeropuerto> resultado = new HashMap<>();
        List<AirportEntity> entities = airportRepository.findAll();
        for (AirportEntity entity : entities) {
            if (entity.codigoOaci == null || entity.codigoOaci.isBlank()) {
                continue;
            }
            String codigo = entity.codigoOaci.trim().toUpperCase(Locale.ROOT);
            String codigoCorto = codigo.toLowerCase(Locale.ROOT);
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
        int total = 0;
        int canceled = 0;
        int invalid = 0;
        int invalidAirport = 0;
        int loaded = 0;
        for (FlightEntity entity : entities) {
            total++;
            if (entity.cancelado) {
                canceled++;
                continue;
            }
            if (entity.origen == null || entity.destino == null || entity.salida == null || entity.llegada == null) {
                invalid++;
                continue;
            }
            String origen = entity.origen.codigoOaci;
            String destino = entity.destino.codigoOaci;
            if (origen == null || destino == null) {
                invalid++;
                continue;
            }
            origen = origen.trim().toUpperCase(Locale.ROOT);
            destino = destino.trim().toUpperCase(Locale.ROOT);
            if (!oaciValidos.contains(origen) || !oaciValidos.contains(destino)) {
                invalidAirport++;
                continue;
            }
            int salidaMin = entity.salida.getHour() * 60 + entity.salida.getMinute();
            int llegadaMin = entity.llegada.getHour() * 60 + entity.llegada.getMinute();
            int capacidad = entity.capacidad;
            int planId = entity.id != null ? entity.id.intValue() : id;

            planes.add(new Vuelo(id++, origen, destino, salidaMin, llegadaMin, capacidad, -1, null, planId));
            loaded++;
            log.info(
                "[DAILY_PLAN] flight accepted id={} codigo={} origen={} destino={} salida={} llegada={} capacidad={} cancelado={}",
                entity.id,
                entity.codigo,
                origen,
                destino,
                entity.salida,
                entity.llegada,
                capacidad,
                entity.cancelado
            );
        }
        log.info(
            "[DAILY_PLAN] flight scan total={} canceled={} invalid={} invalidAirport={} loaded={}",
            total,
            canceled,
            invalid,
            invalidAirport,
            loaded
        );
        return planes;
    }

    private List<Envio> cargarEnviosDb(Map<String, Aeropuerto> aeropuertos, PlanWindow window) {
        List<Envio> envios = new ArrayList<>();
        List<ShipmentEntity> entities = shipmentRepository.findAll();
        LocalDate planLocalDate = LocalDate.parse(window.planDate, DATE_FORMAT);
        int total = 0;
        int invalid = 0;
        int futureDate = 0;
        int outOfWindow = 0;
        int loaded = 0;
        for (ShipmentEntity entity : entities) {
            total++;
            if (!isValidShipment(entity)) {
                invalid++;
                continue;
            }
            // Delivered and cancelled shipments are excluded; in-transit and assigned stay in planning
            // so their routes remain in lastRutasPorPaquete and status can transition to DELIVERED.
            if (entity.status == ShipmentStatus.DELIVERED || entity.status == ShipmentStatus.CANCELLED) {
                continue;
            }
            LocalDate shipmentDate;
            try {
                shipmentDate = LocalDate.parse(entity.fecha, DATE_FORMAT);
            } catch (Exception e) {
                invalid++;
                continue;
            }
            // Skip shipments from future dates; past-dated pending shipments are eligible
            if (shipmentDate.isAfter(planLocalDate)) {
                futureDate++;
                continue;
            }
            int hh = entity.ingresoLocal.getHour();
            int mm = entity.ingresoLocal.getMinute();
            int ingresoMin = hh * 60 + mm;
            String origen = shipmentOrigen(entity);
            String destino = shipmentDestino(entity);
            Aeropuerto aeroOrigen = aeropuertos.get(origen);
            Aeropuerto aeroDestino = aeropuertos.get(destino);
            int sla = entity.slaHoras > 0 ? entity.slaHoras : (aeroOrigen != null && aeroDestino != null)
                ? aeroOrigen.calcularSla(aeroDestino)
                : 24;

            // For today's shipments apply the ingresso window filter; past ones are always eligible
            if (shipmentDate.equals(planLocalDate) && ingresoMin > window.windowEndMin) {
                outOfWindow++;
                continue;
            }

            Envio envio = new Envio(
                entity.codigoPedido,
                origen,
                destino,
                entity.fecha,
                hh,
                mm,
                Math.max(0, entity.cantidad),
                entity.idCliente,
                sla,
                null
            );
            envio.status = entity.status;
            envios.add(envio);
            loaded++;
            log.info(
                "[DAILY_PLAN] shipment accepted pedido={} origen={} destino={} fecha={} ingresoLocal={} ingresoMin={} asignado={} cantidad={} sla={}",
                entity.codigoPedido,
                origen,
                destino,
                entity.fecha,
                entity.ingresoLocal,
                ingresoMin,
                entity.status,
                entity.cantidad,
                sla
            );
        }

        envios.sort((a, b) -> Integer.compare(a.horaIngresoMin, b.horaIngresoMin));
        log.info(
            "[DAILY_PLAN] shipment scan total={} invalid={} futureDate={} outOfWindow={} loaded={}",
            total,
            invalid,
            futureDate,
            outOfWindow,
            loaded
        );
        return envios;
    }

    private List<Vuelo> instanciarVuelos(PlanWindow window, List<Vuelo> planes) {
        int diaIndex = UtilArchivos.obtenerDiaIndex(window.planDate);
        return util.instanciarVuelosPorRango(planes, diaIndex, diaIndex);
    }

    private void removerCancelaciones(PlanWindow window, List<Vuelo> vuelos) {
        LocalDate fecha = LocalDate.parse(window.planDate, DATE_FORMAT);
        List<FlightDayCancellationEntity> cancellations = cancellationRepository.findAll();
        java.util.Set<String> cancelledKeys = new java.util.HashSet<>();
        for (FlightDayCancellationEntity c : cancellations) {
            if (fecha.equals(c.fechaCancelacion)) {
                cancelledKeys.add(c.flightId + "_" + window.planDate);
            }
        }
        vuelos.removeIf(v -> cancelledKeys.contains(v.idPlan + "_" + window.planDate));
    }

    private Individuo planificar(List<Envio> envios, Map<String, Aeropuerto> aeropuertos, List<Vuelo> vuelos) {
        if (envios.isEmpty() || vuelos.isEmpty()) {
            log.warn(
                "[DAILY_PLAN] planning skipped because enviosEmpty={} vuelosEmpty={}",
                envios.isEmpty(),
                vuelos.isEmpty()
            );
            return null;
        }
        ParametrosGa params = new ParametrosGa();
        params.tamanoPoblacion = DEFAULT_POBLACION;
        params.maxGeneraciones = DEFAULT_GENERACIONES;
        params.tasaCruce = DEFAULT_CRUCE;
        params.tasaMutacion = DEFAULT_MUTACION;
        params.tamanoTorneo = DEFAULT_TORNEO;
        params.evaluacionParalela = true;
        params.maxHilosEvaluacion = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
        ObjetivoConfig.aplicar(params);

        GrafoVuelos grafo = new GrafoVuelos(vuelos, aeropuertos);
        PlanificadorGa planificador = new PlanificadorGa(grafo, envios, params, 1L);
        return planificador.ejecutar();
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
                    seg.salidaMin = minuteOfDay(vuelo.salidaMin);
                    seg.llegadaMin = seg.salidaMin + Math.max(0, vuelo.llegadaMin - vuelo.salidaMin);
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

    public RespuestaRutaEnvioDto getShipmentRoute(String codigoPedido) {
        String codigoNormalizado = BagCodeResolver.normalize(codigoPedido);
        if (codigoNormalizado == null) {
            return null;
        }

        BagCodeResolver.ParsedBagCode bagCode = null;
        RespuestaRutaEnvioDto route = lastRutasPorPaquete.get(codigoNormalizado);
        ShipmentEntity shipment = shipmentRepository.findByCodigoPedido(codigoNormalizado);

        if (route == null) {
            bagCode = BagCodeResolver.parse(codigoNormalizado);
            if (bagCode == null) {
                return null;
            }

            route = lastRutasPorPaquete.get(bagCode.codigoPedido);
            shipment = shipmentRepository.findByCodigoPedido(bagCode.codigoPedido);
            if (route == null || shipment == null || !BagCodeResolver.isValidBagNumber(bagCode.numeroMaleta, shipment.cantidad)) {
                return null;
            }
        }

        RespuestaRutaEnvioDto snapshot = new RespuestaRutaEnvioDto();
        snapshot.codigoPedido = bagCode != null ? bagCode.codigoPedido : route.codigoPedido;
        snapshot.estado = route.estado;
        snapshot.tiempoTotalHoras = route.tiempoTotalHoras;
        snapshot.ingresoMin = route.ingresoMin;
        snapshot.ruta = route.ruta != null ? new ArrayList<>(route.ruta) : new ArrayList<>();

        if (shipment != null && shipment.status != null) {
            snapshot.estado = shipment.status.name();
            snapshot.totalMaletas = Math.max(0, shipment.cantidad);
        }

        if (bagCode != null) {
            snapshot.codigoMaleta = bagCode.codigoMaleta;
            snapshot.numeroMaleta = bagCode.numeroMaleta;
            snapshot.consultaMaleta = true;
        }

        return snapshot;
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
            
            String estadoReal = envio.status != null ? envio.status.toString() : "PENDING";

            if (ruta != null && ruta.vuelos != null && !ruta.vuelos.isEmpty()) {
                dto.estado = estadoReal;
                dto.tiempoTotalHoras = ruta.tiempoTotalHoras;
                dto.ruta = new ArrayList<>();
                if (!"DELIVERED".equals(estadoReal) && !"CANCELLED".equals(estadoReal)) {
                    for (Vuelo v : ruta.vuelos) {
                        PasoRutaDto paso = new PasoRutaDto();
                        paso.vueloId = v.id;
                        paso.origen = v.origen;
                        paso.destino = v.destino;
                        paso.salidaMin = minuteOfDay(v.salidaMin);
                        paso.llegadaMin = paso.salidaMin + Math.max(0, v.llegadaMin - v.salidaMin);
                        dto.ruta.add(paso);
                    }
                }
            } else {
                dto.estado = ("DELIVERED".equals(estadoReal) || "CANCELLED".equals(estadoReal)) ? estadoReal : "SIN_RUTA_ENCONTRADA";
                dto.tiempoTotalHoras = 0.0;
                dto.ruta = new ArrayList<>();
            }
            mapa.put(envio.idPedido, dto);
        }
        return mapa;
    }

    private boolean isValidShipment(ShipmentEntity shipment) {
        return shipment != null
            && shipment.codigoPedido != null && !shipment.codigoPedido.isBlank()
            && shipmentOrigen(shipment) != null
            && shipmentDestino(shipment) != null
            && shipment.fecha != null && !shipment.fecha.isBlank()
            && shipment.ingresoLocal != null
            && shipment.idCliente != null && !shipment.idCliente.isBlank();
    }

    private String shipmentOrigen(ShipmentEntity shipment) {
        return shipment != null && shipment.origen != null ? normalizeAirport(shipment.origen.codigoOaci) : null;
    }

    private String shipmentDestino(ShipmentEntity shipment) {
        return shipment != null && shipment.destino != null ? normalizeAirport(shipment.destino.codigoOaci) : null;
    }

    private String normalizeAirport(String airportCode) {
        if (airportCode == null || airportCode.isBlank()) {
            return null;
        }
        return airportCode.trim().toUpperCase(Locale.ROOT);
    }

    private void syncStatusesAfterPlan() {
        if (lastRutasPorPaquete.isEmpty()) {
            return;
        }
        List<ShipmentEntity> allShipments = shipmentRepository.findAll();
        List<ShipmentEntity> toUpdate = new ArrayList<>();
        int toAssigned = 0;
        int toPending = 0;
        for (ShipmentEntity entity : allShipments) {
            if (entity.codigoPedido == null) continue;
            RespuestaRutaEnvioDto route = lastRutasPorPaquete.get(entity.codigoPedido);
            boolean hasRoute = route != null && route.ruta != null && !route.ruta.isEmpty();

            // Reconcile only the planning states here.
            // Real-time transitions (IN_TRANSIT, DELIVERED) remain managed by the operation clock.
            if (entity.status == ShipmentStatus.PENDING && hasRoute) {
                entity.status = ShipmentStatus.ASSIGNED;
                toUpdate.add(entity);
                toAssigned++;
                continue;
            }

            if (entity.status == ShipmentStatus.ASSIGNED && !hasRoute) {
                entity.status = ShipmentStatus.PENDING;
                toUpdate.add(entity);
                toPending++;
            }
        }
        if (!toUpdate.isEmpty()) {
            shipmentRepository.saveAll(toUpdate);
            log.info(
                "[DAILY_PLAN] post-plan status sync assigned={} pending={} total={}",
                toAssigned,
                toPending,
                toUpdate.size()
            );
        }
    }

    public List<String> getShipmentCodesForFlight(String origen, String destino, int salidaMin) {
        List<String> result = new ArrayList<>();
        for (Map.Entry<String, RespuestaRutaEnvioDto> entry : lastRutasPorPaquete.entrySet()) {
            RespuestaRutaEnvioDto route = entry.getValue();
            if (route == null || route.ruta == null) continue;
            for (PasoRutaDto paso : route.ruta) {
                if (origen.equals(paso.origen) && destino.equals(paso.destino) && paso.salidaMin == salidaMin) {
                    result.add(entry.getKey());
                    break;
                }
            }
        }
        return result;
    }

    public List<ShipmentCrudDto> getShipmentsByAirport(String airportCode) {
        String airport = normalizeAirport(airportCode);
        if (airport == null || lastRutasPorPaquete.isEmpty()) {
            log.warn(
                "[DAILY_PLAN][SHIPMENTS_BY_AIRPORT] empty state airport={} routes={}",
                airportCode,
                lastRutasPorPaquete != null ? lastRutasPorPaquete.size() : -1
            );
            return List.of();
        }

        List<String> codes = new ArrayList<>();
        for (Map.Entry<String, RespuestaRutaEnvioDto> entry : lastRutasPorPaquete.entrySet()) {
            RespuestaRutaEnvioDto route = entry.getValue();
            if (route == null || route.ruta == null || route.ruta.isEmpty()) {
                continue;
            }
            boolean matchesAirport = route.ruta.stream().anyMatch(step ->
                step != null && (
                    airport.equals(normalizeAirport(step.origen))
                        || airport.equals(normalizeAirport(step.destino))
                )
            );
            if (matchesAirport) {
                codes.add(entry.getKey());
            }
        }

        log.info(
            "[DAILY_PLAN][SHIPMENTS_BY_AIRPORT] airport={} matchedCodes={} sample={}",
            airport,
            codes.size(),
            codes.stream().limit(10).toList()
        );

        if (codes.isEmpty()) {
            return List.of();
        }

        return shipmentRepository.findByCodigoPedidoIn(codes).stream()
            .map(this::toShipmentDto)
            .collect(Collectors.toList());
    }

    private ShipmentCrudDto toShipmentDto(ShipmentEntity entity) {
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
        dto.status = entity.status;
        dto.auditDateIns = entity.auditDateIns;
        return dto;
    }

    private boolean isWithinWindow(int minute, int start, int end) {
        int dayMinutes = 24 * 60;
        if (end <= dayMinutes) {
            return minute >= start && minute <= end;
        }
        int wrappedEnd = end - dayMinutes;
        return minute >= start || minute <= wrappedEnd;
    }

    private int minutesSince(int previousMinute, int currentMinute) {
        int diff = currentMinute - previousMinute;
        return diff >= 0 ? diff : diff + (24 * 60);
    }

    private int minuteOfDay(int absoluteMinute) {
        return Math.floorMod(absoluteMinute, 24 * 60);
    }

    private static class PlanWindow {
        final String planDate;
        final int windowStartMin;
        final int windowEndMin;

        PlanWindow(String planDate, int windowStartMin, int windowEndMin) {
            this.planDate = planDate;
            this.windowStartMin = windowStartMin;
            this.windowEndMin = windowEndMin;
        }
    }
}
