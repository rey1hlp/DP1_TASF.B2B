package com.tasfb2b.simulador.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.data-loader", name = "enabled", havingValue = "true")
public class DataLoaderRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataLoaderRunner.class);
    private final DataLoaderService dataLoaderService;

    public DataLoaderRunner(DataLoaderService dataLoaderService) {
        this.dataLoaderService = dataLoaderService;
    }

    @Override
    public void run(ApplicationArguments args) {
        DataLoadSummary summary = dataLoaderService.loadAirportsAndFlightsOnly();
        log.info(
                "Carga inicial (core) completada: aeropuertos={}, vuelos={}, envios={}",
                summary.aeropuertosProcesados(),
                summary.vuelosProcesados(),
                summary.enviosProcesados()
        );
    }
}
