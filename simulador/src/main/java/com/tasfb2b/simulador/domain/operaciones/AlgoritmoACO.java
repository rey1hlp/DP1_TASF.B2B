package com.tasfb2b.simulador.domain.operaciones;

import com.tasfb2b.simulador.domain.logistica.Vuelo;
import com.tasfb2b.simulador.repository.VueloRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

@Component
public class AlgoritmoACO implements MotorMetaheuristico {

    private static final int MAX_ESCALAS = 4;
    private static final long SLA_MINUTOS = 90L * 24L * 60L;
    private static final int MAX_CANDIDATOS_POR_NODO = 12;

    private final VueloRepository vueloRepository;
    private final Random random = new Random();
    private int tiempoEjecucionMax = 120;
    private AcoConfig config = AcoConfig.defaults();

    public AlgoritmoACO(VueloRepository vueloRepository) {
        this.vueloRepository = vueloRepository;
    }

    @Override
    public int getTiempoEjecucionMax() {
        return tiempoEjecucionMax;
    }

    @Override
    public void setTiempoEjecucionMax(int tiempoEjecucionMax) {
        this.tiempoEjecucionMax = tiempoEjecucionMax;
    }

    public void setConfig(AcoConfig config) {
        this.config = config;
    }

    @Override
    public PlanViaje calcularRutaOptima(Equipaje equipaje, RedLogistica redLogistica) {
        return calcularRutaOptima(equipaje, Set.of(), config);
    }

    public PlanViaje calcularRutaOptima(Equipaje equipaje, Set<String> vuelosBloqueados, AcoConfig cfg) {
        LocalDateTime inicio = equipaje.getFechaRegistro();
        String origen = equipaje.getOrigen().getCodigoOaci();
        String destino = equipaje.getDestino().getCodigoOaci();
        int cantidad = equipaje.getCantidad();
        List<Vuelo> vuelosBase = vueloRepository.findAll();
        Map<String, List<Vuelo>> vuelosPorOrigen = new HashMap<>();
        Map<String, Vuelo> vueloPorId = new HashMap<>();
        for (Vuelo vuelo : vuelosBase) {
            if (vuelo.getIdVuelo() != null) {
                vueloPorId.put(vuelo.getIdVuelo(), vuelo);
            }
            if (vuelo.getOrigen() == null || vuelo.getOrigen().getCodigoOaci() == null) {
                continue;
            }
            if ((vuelo.getCapacidadMaxima() - vuelo.getEquipajeAsignado()) < cantidad) {
                continue;
            }
            vuelosPorOrigen.computeIfAbsent(vuelo.getOrigen().getCodigoOaci(), k -> new ArrayList<>()).add(vuelo);
        }

        List<Vuelo> mejorRuta = null;
        double mejorCosto = Double.MAX_VALUE;

        Map<String, Double> feromonas = new HashMap<>();
        LocalDateTime limite = LocalDateTime.now().plusSeconds(tiempoEjecucionMax);

        for (int iter = 0; iter < cfg.iteraciones(); iter++) {
            if (LocalDateTime.now().isAfter(limite)) {
                break;
            }

            List<List<Vuelo>> rutasIteracion = new ArrayList<>();
            for (int ant = 0; ant < cfg.hormigas(); ant++) {
                List<Vuelo> ruta = construirRuta(origen, destino, inicio, feromonas, vuelosBloqueados, cfg, vuelosPorOrigen);
                if (!ruta.isEmpty()) {
                    rutasIteracion.add(ruta);
                    double costo = costoRuta(ruta, inicio);
                    if (costo < mejorCosto) {
                        mejorCosto = costo;
                        mejorRuta = ruta;
                    }
                }
            }

            evaporarFeromonas(feromonas, cfg.tasaEvaporacion());
            depositarFeromonas(feromonas, rutasIteracion, inicio);
        }

        if (mejorRuta == null || mejorRuta.isEmpty()) {
            throw new IllegalStateException("No se encontró ruta factible con ACO");
        }

        PlanViaje planViaje = new PlanViaje();
        LocalDateTime eta = mejorRuta.get(mejorRuta.size() - 1).getHoraLlegada();
        planViaje.setVuelos(mejorRuta.stream()
                .map(v -> java.util.Optional.ofNullable(vueloPorId.get(v.getIdVuelo()))
                        .orElseThrow(() -> new IllegalStateException("Vuelo no encontrado: " + v.getIdVuelo())))
                .toList());
        planViaje.setTiempoEstimadoLlegada(eta);
        long minutos = Duration.between(inicio, eta).toMinutes();
        planViaje.setSlaCumplido(minutos <= SLA_MINUTOS);
        return planViaje;
    }

    private List<Vuelo> construirRuta(
            String origen,
            String destino,
            LocalDateTime inicio,
            Map<String, Double> feromonas,
            Set<String> vuelosBloqueados,
            AcoConfig cfg,
            Map<String, List<Vuelo>> vuelosPorOrigen
    ) {
        List<Vuelo> ruta = new ArrayList<>();
        Set<String> visitados = new HashSet<>();
        String actual = origen;
        LocalDateTime tiempoActual = inicio;

        for (int pasos = 0; pasos < MAX_ESCALAS + 1; pasos++) {
            if (actual.equals(destino)) break;
            visitados.add(actual);

            final LocalDateTime tiempoCapturado = tiempoActual;
            List<Vuelo> base = vuelosPorOrigen.getOrDefault(actual, List.of());

            List<Vuelo> candidatos = base.stream()
                    .filter(v -> !vuelosBloqueados.contains(v.getIdVuelo()))
                    .filter(v -> v.getDestino() != null && v.getDestino().getCodigoOaci() != null)
                    .filter(v -> v.getHoraSalida() != null && v.getHoraLlegada() != null)
                    .filter(v -> !visitados.contains(v.getDestino().getCodigoOaci()))
                    .map(v -> normalizarAFecha(v, tiempoCapturado))
                    .filter(v -> v != null && v.getHoraSalida() != null && v.getHoraLlegada() != null)
                    .filter(v -> !v.getHoraSalida().isBefore(tiempoCapturado))
                    .sorted((a, b) -> a.getHoraSalida().compareTo(b.getHoraSalida()))
                    .limit(MAX_CANDIDATOS_POR_NODO)
                    .toList();

            if (candidatos.isEmpty()) return List.of();

            Vuelo siguiente = seleccionarVuelo(candidatos, feromonas, destino, cfg);
            if (siguiente == null || siguiente.getHoraLlegada() == null || siguiente.getDestino() == null) {
                return List.of();
            }

            ruta.add(siguiente);
            actual = siguiente.getDestino().getCodigoOaci();
            tiempoActual = siguiente.getHoraLlegada().plusMinutes(20);
        }

        if (ruta.isEmpty() || !ruta.get(ruta.size() - 1).getDestino().getCodigoOaci().equals(destino)) {
            return List.of();
        }
        return ruta;
    }

    private Vuelo seleccionarVuelo(
            List<Vuelo> candidatos,
            Map<String, Double> feromonas,
            String destinoFinal,
            AcoConfig cfg
    ) {
        if (candidatos == null || candidatos.isEmpty()) {
            return null;
        }
        double[] pesos = new double[candidatos.size()];
        double total = 0.0;
        for (int i = 0; i < candidatos.size(); i++) {
            Vuelo v = candidatos.get(i);
            double tau = feromonas.getOrDefault(v.getIdVuelo(), cfg.feromonaInicial());
            double heuristic = 1.0 / (1.0 + Math.max(1, v.getCapacidadMaxima() - v.getEquipajeAsignado()));
            if (v.getDestino().getCodigoOaci().equals(destinoFinal)) {
                heuristic *= 3.0;
            }
            double peso = Math.pow(tau, cfg.alfa()) * Math.pow(heuristic, cfg.beta());
            if (!Double.isFinite(peso) || peso <= 0.0) {
                peso = 0.0001;
            }
            pesos[i] = peso;
            total += peso;
        }
        if (!Double.isFinite(total) || total <= 0.0) {
            return candidatos.get(random.nextInt(candidatos.size()));
        }
        double pick = random.nextDouble() * total;
        double acumulado = 0.0;
        for (int i = 0; i < candidatos.size(); i++) {
            acumulado += pesos[i];
            if (pick <= acumulado) {
                return candidatos.get(i);
            }
        }
        return candidatos.get(candidatos.size() - 1);
    }

    private void evaporarFeromonas(Map<String, Double> feromonas, double tasa) {
        feromonas.replaceAll((k, v) -> Math.max(0.0001, v * (1.0 - tasa)));
    }

    private void depositarFeromonas(Map<String, Double> feromonas, List<List<Vuelo>> rutas, LocalDateTime inicio) {
        for (List<Vuelo> ruta : rutas) {
            double costo = costoRuta(ruta, inicio);
            double delta = 1.0 / Math.max(1.0, costo);
            for (Vuelo vuelo : ruta) {
                feromonas.merge(vuelo.getIdVuelo(), delta, Double::sum);
            }
        }
    }

    private double costoRuta(List<Vuelo> ruta, LocalDateTime inicio) {
        LocalDateTime eta = ruta.get(ruta.size() - 1).getHoraLlegada();
        long minutos = Duration.between(inicio, eta).toMinutes();
        int escalas = Math.max(0, ruta.size() - 1);
        return minutos + (escalas * 120.0);
    }

    private Vuelo normalizarAFecha(Vuelo base, LocalDateTime referencia) {
        if (base == null || base.getHoraSalida() == null || base.getHoraLlegada() == null || referencia == null) {
            return null;
        }
        LocalDate date = referencia.toLocalDate();
        LocalTime salida = base.getHoraSalida().toLocalTime();
        LocalTime llegada = base.getHoraLlegada().toLocalTime();

        LocalDateTime salidaReal = LocalDateTime.of(date, salida);
        LocalDateTime llegadaReal = LocalDateTime.of(date, llegada);
        if (!llegadaReal.isAfter(salidaReal)) {
            llegadaReal = llegadaReal.plusDays(1);
        }
        if (salidaReal.isBefore(referencia)) {
            salidaReal = salidaReal.plusDays(1);
            llegadaReal = llegadaReal.plusDays(1);
        }

        Vuelo v = new Vuelo();
        v.setIdVuelo(base.getIdVuelo());
        v.setOrigen(base.getOrigen());
        v.setDestino(base.getDestino());
        v.setEstado(base.getEstado());
        v.setCapacidadMaxima(base.getCapacidadMaxima());
        v.setEquipajeAsignado(base.getEquipajeAsignado());
        v.setHoraSalida(salidaReal);
        v.setHoraLlegada(llegadaReal);
        return v;
    }
}
