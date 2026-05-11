package com.tasf_b2b.planificador.nucleo;

import com.tasf_b2b.planificador.dominio.Aeropuerto;
import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ForkJoinPool;
import java.util.stream.IntStream;

public class PlanificadorGa {
    private final GrafoVuelos grafo;
    private final ParametrosGa params;
    private final List<Envio> envios;
    private final Random rnd;
    private final Map<String, Integer> capacidadPorAeropuerto;

    private final int[] cargaVuelo;
    private final int[] marcaVuelo;
    private int marcaActual = 1;
    private final List<Vuelo> vuelos;

    private final ForkJoinPool poolEvaluacion;
    private final ThreadLocal<int[]> bufferCargaVuelo;
    private final ThreadLocal<int[]> bufferMarcaVuelo;
    private final int tamanoPoblacionEfectivo;

    public PlanificadorGa(GrafoVuelos grafo, List<Envio> envios, ParametrosGa params, long semilla) {
        this.grafo = grafo;
        this.envios = envios;
        this.params = params;
        this.rnd = new Random(semilla);
        this.capacidadPorAeropuerto = new HashMap<>();
        this.vuelos = grafo.obtenerVuelos();

        int nVuelos = Math.max(0, vuelos.size());
        this.cargaVuelo = new int[nVuelos];
        this.marcaVuelo = new int[nVuelos];
        this.bufferCargaVuelo = ThreadLocal.withInitial(() -> new int[nVuelos]);
        this.bufferMarcaVuelo = ThreadLocal.withInitial(() -> new int[nVuelos]);

        this.tamanoPoblacionEfectivo = calcularTamanoPoblacionEfectivo();
        int hilos = Math.max(1, esInstanciaMasiva() ? Math.min(params.maxHilosMasivo, params.maxHilosEvaluacion) : params.maxHilosEvaluacion);
        this.poolEvaluacion = (params.evaluacionParalela && hilos > 1) ? new ForkJoinPool(hilos) : null;

        for (Map.Entry<String, Aeropuerto> entry : grafo.obtenerAeropuertos().entrySet()) {
            Aeropuerto aeropuerto = entry.getValue();
            int capacidad = (aeropuerto != null) ? aeropuerto.capacidad : 500;
            capacidadPorAeropuerto.put(entry.getKey(), capacidad);
        }
    }

    public Individuo ejecutar() {
        try {
            Individuo eliteInicial = construirEliteInicial();
            if (eliteInicial != null) {
                calcularFitness(eliteInicial);
                if (eliteInicial.esFactible()) {
                    if (params.logGeneraciones || esInstanciaMasiva()) {
                        System.out.println("Corte temprano GA: solucion voraz inicial factible.");
                    }
                    return eliteInicial;
                }
                if (esInstanciaMasiva()) {
                    repararEliteInicial(eliteInicial);
                    if (eliteInicial.esFactible()) {
                        System.out.println("Corte temprano GA: solucion voraz reparada factible.");
                        return eliteInicial;
                    }
                }
            }

            List<Individuo> poblacion = inicializarPoblacion(eliteInicial);

            Individuo mejorGlobal = null;
            int generacionesSinMejora = 0;
            long inicio = System.currentTimeMillis();
            long deadline = params.maxTiempoMs > 0 ? inicio + params.maxTiempoMs : Long.MAX_VALUE;

            for (int gen = 0; gen < params.maxGeneraciones; gen++) {
                if (System.currentTimeMillis() >= deadline) {
                    break;
                }

                evaluarPoblacion(poblacion);
                Collections.sort(poblacion);

                if (params.usarReparacion
                    && params.intervaloReparacion > 0
                    && (gen % params.intervaloReparacion == 0)) {
                    Individuo elite = poblacion.get(0);
                    if (ReparadorSolucion.reparar(
                        elite,
                        grafo,
                        envios,
                        capacidadPorAeropuerto,
                        cargaVuelo,
                        marcaVuelo,
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
                    )) {
                        elite.fitnessValido = true;
                        Collections.sort(poblacion);
                    }
                    if (elite.esFactible()) {
                        if (params.logGeneraciones || esInstanciaMasiva()) {
                            System.out.println("Corte temprano GA: elite factible en generacion " + gen + ".");
                        }
                        return elite;
                    }
                }

                if (mejorGlobal == null || poblacion.get(0).fitness < mejorGlobal.fitness) {
                    mejorGlobal = poblacion.get(0).clonar();
                    generacionesSinMejora = 0;
                } else {
                    generacionesSinMejora++;
                }

                if (params.logGeneraciones) {
                    System.out.println("Generacion " + gen + " - Mejor Fitness: " + poblacion.get(0).fitness);
                }

                if (poblacion.get(0).esFactible()) {
                    if (params.logGeneraciones || esInstanciaMasiva()) {
                        System.out.println("Corte temprano GA: mejor individuo factible en generacion " + gen + ".");
                    }
                    return poblacion.get(0);
                }

                if (params.maxGeneracionesSinMejora > 0
                    && generacionesSinMejora >= params.maxGeneracionesSinMejora) {
                    break;
                }

                List<Individuo> nuevaPoblacion = new ArrayList<>(tamanoPoblacionEfectivo);
                nuevaPoblacion.add(poblacion.get(0).clonar());

                while (nuevaPoblacion.size() < tamanoPoblacionEfectivo) {
                    Individuo padre1 = seleccionarPadre(poblacion);
                    Individuo padre2 = seleccionarPadre(poblacion);

                    Individuo hijo = (rnd.nextDouble() < params.tasaCruce)
                        ? cruzar(padre1, padre2)
                        : padre1.clonar();

                    if (rnd.nextDouble() < params.tasaMutacion) {
                        mutar(hijo);
                    }
                    nuevaPoblacion.add(hijo);
                }

                poblacion = nuevaPoblacion;
            }

            return mejorGlobal != null ? mejorGlobal : poblacion.get(0);
        } finally {
            if (poolEvaluacion != null) {
                poolEvaluacion.shutdown();
            }
        }
    }

    private void evaluarPoblacion(List<Individuo> poblacion) {
        if (poolEvaluacion == null || poblacion.size() < 4 || esInstanciaMasiva()) {
            poblacion.forEach(this::calcularFitness);
            return;
        }
        try {
            poolEvaluacion.submit(() ->
                IntStream.range(0, poblacion.size()).parallel().forEach(i -> calcularFitnessThreadLocal(poblacion.get(i)))
            ).get();
        } catch (Exception e) {
            throw new RuntimeException("Error evaluando poblacion GA en paralelo", e);
        }
    }

    private void calcularFitness(Individuo ind) {
        if (ind.fitnessValido) {
            return;
        }
        if (marcaActual == Integer.MAX_VALUE) {
            Arrays.fill(marcaVuelo, 0);
            marcaActual = 1;
        }
        final int marcaLocal = marcaActual++;
        ind.fitness = EvaluadorFitness.evaluar(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaVuelo,
            marcaVuelo,
            marcaLocal,
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
        ind.fitnessValido = true;
    }

    private void calcularFitnessThreadLocal(Individuo ind) {
        if (ind.fitnessValido) {
            return;
        }
        int[] carga = bufferCargaVuelo.get();
        int[] marca = bufferMarcaVuelo.get();
        Arrays.fill(marca, 0);
        ind.fitness = EvaluadorFitness.evaluar(
            ind,
            envios,
            capacidadPorAeropuerto,
            carga,
            marca,
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
        ind.fitnessValido = true;
    }

    private Individuo seleccionarPadre(List<Individuo> poblacion) {
        Individuo mejor = null;
        for (int i = 0; i < params.tamanoTorneo; i++) {
            Individuo competidor = poblacion.get(rnd.nextInt(poblacion.size()));
            if (mejor == null || competidor.fitness < mejor.fitness) {
                mejor = competidor;
            }
        }
        return mejor;
    }

    private Individuo cruzar(Individuo p1, Individuo p2) {
        Individuo hijo = new Individuo(envios.size());
        int puntoCorte = rnd.nextInt(envios.size());
        for (int i = 0; i < envios.size(); i++) {
            hijo.asignaciones[i] = (i < puntoCorte) ? p1.asignaciones[i] : p2.asignaciones[i];
        }
        hijo.fitnessValido = false;
        return hijo;
    }

    private void mutar(Individuo ind) {
        int genesAMutar = calcularGenesAMutar();
        Set<Integer> indicesMutados = new HashSet<>();

        for (int intento = 0; intento < genesAMutar * 3 && indicesMutados.size() < genesAMutar; intento++) {
            int idx = elegirIndiceMutacion(ind);
            if (!indicesMutados.add(idx)) {
                continue;
            }

            Envio envio = envios.get(idx);
            int maxEscalas = 2 + rnd.nextInt(5);
            List<Vuelo> nuevaRutaVuelos = grafo.buscarRutaAleatoria(
                envio.origen,
                envio.destino,
                envio.horaIngresoMin,
                maxEscalas,
                params.minEscalaMin
            );

            if (nuevaRutaVuelos != null) {
                ind.asignaciones[idx] = new Ruta(
                    nuevaRutaVuelos,
                    envio.horaIngresoMin,
                    envio.slaHoras,
                    params.minRecojoMin
                );
                ind.fitnessValido = false;
            }
        }
    }

    private int calcularGenesAMutar() {
        if (envios.isEmpty()) {
            return 0;
        }
        int base = Math.max(2, envios.size() / 200);
        int cap = esInstanciaMasiva() ? params.maxGenesMutacionMasiva : params.maxGenesMutacion;
        return Math.min(envios.size(), Math.min(base, cap));
    }

    private int elegirIndiceMutacion(Individuo ind) {
        for (int intento = 0; intento < 8; intento++) {
            int idx = rnd.nextInt(envios.size());
            Ruta ruta = ind.asignaciones[idx];
            if (ruta == null || ruta.vuelos == null || ruta.vuelos.isEmpty() || !ruta.cumpleSLA) {
                return idx;
            }
        }
        return rnd.nextInt(envios.size());
    }

    private List<Individuo> inicializarPoblacion(Individuo eliteInicial) {
        List<Individuo> lista = new ArrayList<>(tamanoPoblacionEfectivo);
        if (eliteInicial != null) {
            lista.add(eliteInicial);
        }
        for (int i = lista.size(); i < tamanoPoblacionEfectivo; i++) {
            Individuo ind = lista.get(0).clonar();
            ind.fitnessValido = false;

            int genesIniciales = calcularGenesMutacionInicial();
            Set<Integer> indicesMutados = new HashSet<>();
            for (int intento = 0; intento < genesIniciales * 3 && indicesMutados.size() < genesIniciales; intento++) {
                int idx = rnd.nextInt(envios.size());
                if (!indicesMutados.add(idx)) {
                    continue;
                }

                Envio envio = envios.get(idx);
                int maxEscalas = 2 + rnd.nextInt(5);
                List<Vuelo> vuelosRuta = grafo.buscarRutaAleatoria(
                    envio.origen,
                    envio.destino,
                    envio.horaIngresoMin,
                    maxEscalas,
                    params.minEscalaMin
                );
                ind.asignaciones[idx] = new Ruta(vuelosRuta, envio.horaIngresoMin, envio.slaHoras, params.minRecojoMin);
            }
            lista.add(ind);
        }
        return lista;
    }

    private Individuo construirEliteInicial() {
        if (tamanoPoblacionEfectivo <= 0) {
            return null;
        }
        Individuo voraz = ConstructorSolucionVoraz.construir(
            grafo,
            envios,
            vuelos,
            12,
            params.minEscalaMin,
            params.minRecojoMin
        );
        voraz.fitnessValido = false;
        return voraz;
    }

    private boolean esFactible(Individuo ind) {
        if (marcaActual == Integer.MAX_VALUE) {
            Arrays.fill(marcaVuelo, 0);
            marcaActual = 1;
        }
        return EvaluadorFitness.esFactible(
            ind,
            envios,
            capacidadPorAeropuerto,
            cargaVuelo,
            marcaVuelo,
            marcaActual++,
            params.minEscalaMin,
            params.minRecojoMin
        );
    }

    private boolean esInstanciaMasiva() {
        return params.modoMasivoAdaptativo && envios.size() >= params.umbralInstanciaMasiva;
    }

    private int calcularTamanoPoblacionEfectivo() {
        int solicitado = Math.max(1, params.tamanoPoblacion);
        if (!params.modoMasivoAdaptativo) {
            return solicitado;
        }
        long bytesPorIndividuo = 16L + (long) envios.size() * 8L;
        long presupuestoBytes = Math.max(64L, params.presupuestoPoblacionMb) * 1024L * 1024L;
        int maxPorMemoria = (int) Math.max(1L, presupuestoBytes / Math.max(1L, bytesPorIndividuo));
        int capMasivo = esInstanciaMasiva() ? params.maxTamPoblacionMasiva : solicitado;
        int efectivo = Math.max(1, Math.min(solicitado, Math.min(capMasivo, maxPorMemoria)));
        if (efectivo < solicitado) {
            System.out.println(
                "Ajuste adaptativo GA: poblacion " + solicitado + " -> " + efectivo +
                " por tamano de instancia/memoria."
            );
        }
        return efectivo;
    }

    private void repararEliteInicial(Individuo elite) {
        if (!params.usarReparacion || params.rondasReparacionInicial <= 0) {
            return;
        }
        for (int i = 0; i < params.rondasReparacionInicial; i++) {
            boolean mejoro = ReparadorSolucion.reparar(
                elite,
                grafo,
                envios,
                capacidadPorAeropuerto,
                cargaVuelo,
                marcaVuelo,
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
            elite.fitnessValido = true;
            if (elite.esFactible() || !mejoro) {
                return;
            }
        }
    }

    private int calcularGenesMutacionInicial() {
        if (envios.isEmpty()) {
            return 0;
        }
        int base = Math.max(8, envios.size() / 50);
        return Math.min(envios.size(), Math.min(256, base));
    }
}
