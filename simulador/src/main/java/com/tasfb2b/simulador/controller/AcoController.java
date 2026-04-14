package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.domain.operaciones.AcoBatchResult;
import com.tasfb2b.simulador.domain.operaciones.AcoConfig;
import com.tasfb2b.simulador.domain.operaciones.AcoPlanificacionRequest;
import com.tasfb2b.simulador.domain.operaciones.AcoReplanificacionRequest;
import com.tasfb2b.simulador.domain.operaciones.AcoResult;
import com.tasfb2b.simulador.service.AcoRoutingService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/algoritmos/aco")
public class AcoController {

    private final AcoRoutingService routingService;

    public AcoController(AcoRoutingService routingService) {
        this.routingService = routingService;
    }

    @PostMapping("/planificar/{idEnvio}")
    @ResponseStatus(HttpStatus.OK)
    public AcoResult planificar(
            @PathVariable String idEnvio,
            @RequestBody(required = false) AcoPlanificacionRequest request
    ) {
        try {
            return routingService.planificar(idEnvio, mergeConfig(request));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage(), ex);
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), ex);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Error en cálculo ACO: " + ex.getMessage(), ex);
        }
    }

    @PostMapping("/replanificar/{idEnvio}")
    @ResponseStatus(HttpStatus.OK)
    public AcoResult replanificar(
            @PathVariable String idEnvio,
            @RequestBody AcoReplanificacionRequest request
    ) {
        try {
            return routingService.replanificar(idEnvio, request, AcoConfig.defaults());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage(), ex);
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), ex);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Error en cálculo ACO: " + ex.getMessage(), ex);
        }
    }

    @PostMapping("/planificar-pendientes")
    @ResponseStatus(HttpStatus.OK)
    public AcoBatchResult planificarPendientes(
            @RequestParam(defaultValue = "2000") int limite,
            @RequestBody(required = false) AcoPlanificacionRequest request
    ) {
        AcoConfig config = tunedBatchConfig(mergeConfig(request), limite);
        return routingService.planificarPendientes(limite, config);
    }

    private AcoConfig mergeConfig(AcoPlanificacionRequest req) {
        AcoConfig base = AcoConfig.defaults();
        if (req == null) {
            return base;
        }
        return new AcoConfig(
                req.getHormigas() == null ? base.hormigas() : req.getHormigas(),
                req.getIteraciones() == null ? base.iteraciones() : req.getIteraciones(),
                req.getAlfa() == null ? base.alfa() : req.getAlfa(),
                req.getBeta() == null ? base.beta() : req.getBeta(),
                req.getTasaEvaporacion() == null ? base.tasaEvaporacion() : req.getTasaEvaporacion(),
                req.getFeromonaInicial() == null ? base.feromonaInicial() : req.getFeromonaInicial()
        );
    }

    private AcoConfig tunedBatchConfig(AcoConfig input, int limite) {
        if (limite <= 100) {
            return input;
        }
        int hormigas = Math.min(input.hormigas(), 8);
        int iteraciones = Math.min(input.iteraciones(), 10);
        return new AcoConfig(
                Math.max(3, hormigas),
                Math.max(4, iteraciones),
                input.alfa(),
                input.beta(),
                input.tasaEvaporacion(),
                input.feromonaInicial()
        );
    }
}
