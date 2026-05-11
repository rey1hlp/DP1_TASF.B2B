package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class PlanificadorAco {
    private final GrafoVuelos grafo;
    private final List<Vuelo> vuelos;
    private final List<Envio> envios;
    private final ParametrosAco params;
    private final double[] feromonas;

    private final int[] vueloDestinoIndex;
    private final int[] capacidadAlmacen;
    private final int numAeropuertos;

    private final Map<String, Integer> aeropuertoIndex;
    private final Map<String, Integer> capacidadPorAeropuerto;

    private final ThreadLocal<boolean[]>   bufferVisitados;
    private final ThreadLocal<int[]>       bufferCargaVuelos;
    private final ThreadLocal<int[]>       bufferOcupacion;
    private final ThreadLocal<List<Integer>> bufferIndicesUsados;
    private final ThreadLocal<List<Vuelo>>   bufferPosibles;

    public PlanificadorAco(GrafoVuelos grafo, List<Vuelo> vuelos, List<Envio> envios, ParametrosAco params) {
        this.grafo  = grafo;
        this.vuelos = vuelos;
        this.envios = envios;
        this.params = params;


        this.aeropuertoIndex = new HashMap<>();
        this.capacidadPorAeropuerto = new HashMap<>();
        int idx = 0;
        for (String codigo : grafo.obtenerAeropuertos().keySet()) {
            aeropuertoIndex.put(codigo, idx++);
        }
        this.numAeropuertos = aeropuertoIndex.size();

        this.capacidadAlmacen = new int[numAeropuertos];
        for (Map.Entry<String, Integer> entry : aeropuertoIndex.entrySet()) {
            Aeropuerto a = grafo.obtenerAeropuertos().get(entry.getKey());
            capacidadAlmacen[entry.getValue()] = (a != null) ? a.capacidad : 500;
            capacidadPorAeropuerto.put(entry.getKey(), (a != null) ? a.capacidad : 500);
        }

        this.vueloDestinoIndex = new int[vuelos.size()];
        for (int i = 0; i < vuelos.size(); i++) {
            Vuelo v    = vuelos.get(i);
            Integer aI = aeropuertoIndex.get(v.destino);
            vueloDestinoIndex[i] = (aI == null) ? -1 : aI;
        }

        this.feromonas = new double[vuelos.size()];
        Arrays.fill(feromonas, 1.0);

        final int nVuelos      = vuelos.size();
        final int nAeropuertos = numAeropuertos;
        final int maxEscalas   = params.maxEscalas;

        this.bufferVisitados    = ThreadLocal.withInitial(() -> new boolean[nAeropuertos]);
        this.bufferCargaVuelos  = ThreadLocal.withInitial(() -> new int[nVuelos]);
        this.bufferOcupacion    = ThreadLocal.withInitial(() -> new int[nAeropuertos]);
        this.bufferIndicesUsados = ThreadLocal.withInitial(() -> new ArrayList<>(maxEscalas + 1));
        this.bufferPosibles      = ThreadLocal.withInitial(ArrayList::new);
    }

    public Individuo ejecutar() {
        Individuo mejorGlobal = ConstructorSolucionVoraz.construir(
            grafo,
            envios,
            vuelos,
            params.maxEscalas,
            params.minEscalaMin,
            params.minRecojoMin
        );
        calcularFitnessLocal(mejorGlobal);
        if (esFactible(mejorGlobal)) {
            return mejorGlobal;
        }
        depositarFeromona(mejorGlobal, (params.q * 2.0) / (1.0 + mejorGlobal.fitness));

        long inicio   = System.currentTimeMillis();
        long deadline = params.maxTiempoMs > 0
                ? (inicio + params.maxTiempoMs)
                : Long.MAX_VALUE;

        for (int iter = 0; iter < params.maxIteraciones; iter++) {
            if (System.currentTimeMillis() >= deadline) break;

            List<Individuo> colonia = IntStream.range(0, params.numeroHormigas)
                    .parallel()
                    .mapToObj(i -> {
                        Individuo h = construirSolucion();
                        calcularFitnessLocal(h);
                        return h;
                    })
                    .collect(Collectors.toList());

            Individuo mejorIteracion = colonia.stream()
                    .min((a, b) -> Double.compare(a.fitness, b.fitness))
                    .orElse(null);

            if (mejorIteracion != null
                && params.usarReparacion
                && params.intervaloReparacion > 0
                && (iter % params.intervaloReparacion == 0)) {
                ReparadorSolucion.reparar(
                    mejorIteracion,
                    grafo,
                    envios,
                    capacidadPorAeropuerto,
                    bufferCargaVuelos.get(),
                    new int[vuelos.size()],
                    params.pesoTiempo,
                    params.pesoEscalas,
                    params.penalidadSinRuta,
                    params.penalidadSLA,
                    params.penalidadHoraRetraso,
                    params.penalidadCapVuelo,
                    params.penalidadCapAlmacen,
                    params.minEscalaMin,
                    params.minRecojoMin,
                    params.maxEnviosARreparar,
                    params.intentosReparacionPorEnvio
                );
            }

            if (mejorGlobal == null || mejorIteracion.fitness < mejorGlobal.fitness) {
                mejorGlobal = mejorIteracion.clonar();
            }

            actualizarFeromonas(mejorIteracion, mejorGlobal);

            if (params.logIteraciones &&
                    (iter % params.logCada == 0 || iter == params.maxIteraciones - 1)) {
                System.out.println("Iteracion ACO " + iter
                        + " - Mejor Fitness: " + mejorGlobal.fitness);
            }
        }

        return mejorGlobal;
    }

    private Individuo construirSolucion() {
        Individuo ind = new Individuo(envios.size());
        for (int i = 0; i < envios.size(); i++) {
            Envio e = envios.get(i);
            List<Vuelo> rutaVuelos = construirRutaParaEnvio(e);
            ind.asignaciones[i] = new Ruta(rutaVuelos, e.horaIngresoMin, e.slaHoras, params.minRecojoMin);
        }
        return ind;
    }

    private List<Vuelo> construirRutaParaEnvio(Envio envio) {
        boolean[]    visitados    = bufferVisitados.get();
        List<Integer> indicesUsados = bufferIndicesUsados.get();
        indicesUsados.clear();

        List<Vuelo> ruta         = new ArrayList<>(params.maxEscalas);
        String      actual       = envio.origen;
        int         tiempoActual = envio.horaIngresoMin;

        marcarVisitado(visitados, actual, indicesUsados);

        for (int escala = 0; escala < params.maxEscalas; escala++) {
            final int   tiempoMinimoSalida = tiempoActual + params.minEscalaMin;
            List<Vuelo> posibles           = bufferPosibles.get();
            posibles.clear();

            for (Vuelo v : grafo.obtenerVuelosDesde(actual, tiempoMinimoSalida)) {
                if (v.salidaMin < tiempoMinimoSalida)  continue;
                if (estaVisitado(visitados, v.destino)) continue;
                posibles.add(v);
            }

            if (posibles.isEmpty()) {
                limpiarVisitados(visitados, indicesUsados);
                return null;
            }

            Vuelo elegido = seleccionarVueloProbabilistico(posibles, envio, tiempoActual, escala);
            ruta.add(elegido);
            actual       = elegido.destino;
            tiempoActual = elegido.llegadaMin;
            marcarVisitado(visitados, actual, indicesUsados);

            if (actual.equals(envio.destino)) {
                limpiarVisitados(visitados, indicesUsados);
                return ruta;
            }
        }

        limpiarVisitados(visitados, indicesUsados);
        return null;
    }

    private void marcarVisitado(boolean[] buf, String aeropuerto, List<Integer> usados) {
        Integer idx = aeropuertoIndex.get(aeropuerto);
        if (idx == null) return;
        buf[idx] = true;
        usados.add(idx);
    }

    private boolean estaVisitado(boolean[] buf, String aeropuerto) {
        Integer idx = aeropuertoIndex.get(aeropuerto);
        return idx != null && buf[idx];
    }

    private void limpiarVisitados(boolean[] buf, List<Integer> usados) {
        for (int i : usados) buf[i] = false;
        usados.clear();
    }

    private Vuelo seleccionarVueloProbabilistico(List<Vuelo> candidatos, Envio envio, int tiempoActual, int escalaActual) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();

        double[] pesos = new double[candidatos.size()];
        double suma = 0.0;

        for (int i = 0; i < candidatos.size(); i++) {
            Vuelo  v   = candidatos.get(i);
            double tau = feromonas[v.id];
            double eta = calcularHeuristica(v, envio, tiempoActual, escalaActual);
            double p   = Math.pow(tau, params.alpha) * Math.pow(eta, params.beta);
            pesos[i]   = p;
            suma       += p;
        }

        if (suma <= 0.0) {
            return candidatos.get(rnd.nextInt(candidatos.size()));
        }

        double umbral    = rnd.nextDouble() * suma;
        double acumulado = 0.0;
        for (int i = 0; i < candidatos.size(); i++) {
            acumulado += pesos[i];
            if (acumulado >= umbral) return candidatos.get(i);
        }

        return candidatos.get(candidatos.size() - 1);
    }

    private double calcularHeuristica(Vuelo v, Envio envio, int tiempoActual, int escalaActual) {
        int esperaMin = Math.max(0, v.salidaMin - tiempoActual);
        int duracionMin = Math.max(0, v.llegadaMin - v.salidaMin);
        double llegadaHorasDesdeIngreso = Math.max(0, v.llegadaMin - envio.horaIngresoMin) / 60.0;
        double retrasoEstimado = Math.max(0.0, llegadaHorasDesdeIngreso - envio.slaHoras);

        double costo = esperaMin + duracionMin;
        costo += retrasoEstimado * 180.0;
        costo += escalaActual * 12.0;
        if (v.destino.equals(envio.destino)) costo *= 0.2;

        return 1.0 / (1.0 + costo);
    }

    private void actualizarFeromonas(Individuo mejorIteracion, Individuo mejorGlobal) {
        double factorEvaporacion = Math.max(0.0, 1.0 - params.evaporacion);
        for (int i = 0; i < feromonas.length; i++) {
            feromonas[i] = Math.max(0.0001, feromonas[i] * factorEvaporacion);
        }
        depositarFeromona(mejorIteracion, params.q / (1.0 + mejorIteracion.fitness));
        depositarFeromona(mejorGlobal,    (params.q * 1.5) / (1.0 + mejorGlobal.fitness));
    }

    private void depositarFeromona(Individuo ind, double deltaBase) {
        for (int i = 0; i < envios.size(); i++) {
            Envio e    = envios.get(i);
            Ruta  ruta = ind.asignaciones[i];

            if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty()) continue;

            double delta = deltaBase * Math.max(1.0, e.cantidad);
            for (Vuelo v : ruta.vuelos) {
                feromonas[v.id] += delta;
            }
        }
    }

    private void calcularFitnessLocal(Individuo ind) {
        int[] cargaLocal = bufferCargaVuelos.get();
        int[] marcaLocal = new int[cargaLocal.length];
        ind.fitness = EvaluadorFitness.evaluar(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaLocal,
            marcaLocal,
            1,
            params.pesoTiempo,
            params.pesoEscalas,
            params.penalidadSinRuta,
            params.penalidadSLA,
            params.penalidadHoraRetraso,
            params.penalidadCapVuelo,
            params.penalidadCapAlmacen,
            params.minEscalaMin,
            params.minRecojoMin
        );
    }

    private boolean esFactible(Individuo ind) {
        int[] cargaLocal = bufferCargaVuelos.get();
        Arrays.fill(cargaLocal, 0);
        int[] marcaLocal = new int[cargaLocal.length];
        return EvaluadorFitness.esFactible(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaLocal,
            marcaLocal,
            1,
            params.minEscalaMin,
            params.minRecojoMin
        );
    }
}
