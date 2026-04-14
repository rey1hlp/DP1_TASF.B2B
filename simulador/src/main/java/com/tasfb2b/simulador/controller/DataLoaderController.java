package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.bootstrap.DataLoadSummary;
import com.tasfb2b.simulador.bootstrap.DataLoaderService;
import com.tasfb2b.simulador.controller.dto.DeleteResultDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/data-loader")
public class DataLoaderController {

    private final DataLoaderService dataLoaderService;

    public DataLoaderController(DataLoaderService dataLoaderService) {
        this.dataLoaderService = dataLoaderService;
    }

    @PostMapping("/run")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DataLoadSummary runLoader() {
        return dataLoaderService.loadAirportsAndFlightsOnly();
    }

    @PostMapping("/run-shipments")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DataLoadSummary runShipmentsLoader() {
        return dataLoaderService.loadShipmentsOnly();
    }

    @PostMapping("/shipments/file/{fileName}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DataLoadSummary runShipmentsByFile(
            @PathVariable String fileName,
            @RequestParam(required = false) Integer limit
    ) {
        try {
            return dataLoaderService.loadShipmentsByFile(fileName, limit);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
    }

    @PostMapping("/shipments/all-files")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DataLoadSummary runAllShipmentsFromFolder() {
        return dataLoaderService.loadAllShipmentsFromFolder();
    }

    @DeleteMapping("/shipments")
    @ResponseStatus(HttpStatus.OK)
    public DeleteResultDto deleteAllShipments() {
        int deleted = dataLoaderService.deleteAllShipments();
        return new DeleteResultDto("equipajes", deleted);
    }
}
