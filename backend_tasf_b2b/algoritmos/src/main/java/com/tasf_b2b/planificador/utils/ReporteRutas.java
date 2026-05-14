package com.tasf_b2b.planificador.utils;

import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.dominio.Vuelo;
import com.tasf_b2b.planificador.nucleo.Individuo;
import com.tasf_b2b.planificador.nucleo.Ruta;

import java.io.FileWriter;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

public class ReporteRutas {

    private static final DateTimeFormatter TS_FORMAT =
        DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    public static Path escribirReporte(
        Path raizProyecto,
        List<Envio> envios,
        Individuo individuo,
        String etiqueta
    ) throws java.io.IOException {

        if (envios == null
            || envios.isEmpty()
            || individuo == null
            || individuo.asignaciones == null) {

            return null;
        }

        String ts =
            LocalDateTime.now().format(TS_FORMAT);

        String nombre =
            ts + "-simulation-report.csv";

        Path dir =
            raizProyecto.resolve("tmp_run");

        Files.createDirectories(dir);

        Path salida =
            dir.resolve(nombre);

        boolean incluirEtiqueta =
            etiqueta != null
                && !etiqueta.isBlank();

        try (PrintWriter pw =
                 new PrintWriter(
                     new FileWriter(salida.toFile()))) {

            pw.print(
                "id_pedido," +
                "origen," +
                "destino," +
                "fecha," +
                "hora," +
                "cantidad," +
                "id_cliente," +
                "sla_horas," +
                "tiene_ruta," +
                "num_vuelos," +
                "ruta," +
                "cumple_sla," +
                "tiempo_total_horas"
            );

            if (incluirEtiqueta) {
                pw.print(",etiqueta");
            }

            pw.println();

            for (int i = 0; i < envios.size(); i++) {

                Envio envio = envios.get(i);
                Ruta ruta = individuo.asignaciones[i];

                boolean tieneRuta =
                    ruta != null
                        && ruta.vuelos != null
                        && !ruta.vuelos.isEmpty();

                String hora =
                    UtilArchivos.formatearHora(
                        envio.horaIngresoLocal
                    );

                String descripcionRuta =
                    construirDescripcionRuta(ruta);

                int numVuelos =
                    tieneRuta
                        ? ruta.vuelos.size()
                        : 0;

                boolean cumpleSla =
                    tieneRuta && ruta.cumpleSLA;

                double tiempoTotal =
                    tieneRuta
                        ? ruta.tiempoTotalHoras
                        : -1;

                pw.printf(
                    "%s,%s,%s,%s,%s,%d,%s,%d,%s,%d,\"%s\",%s,%.2f",
                    envio.idPedido,
                    envio.origen,
                    envio.destino,
                    envio.fecha,
                    hora,
                    envio.cantidad,
                    envio.idCliente,
                    envio.slaHoras,
                    tieneRuta,
                    numVuelos,
                    descripcionRuta,
                    cumpleSla,
                    tiempoTotal
                );

                if (incluirEtiqueta) {
                    pw.printf(",%s", etiqueta);
                }

                pw.println();
            }
        }

        return salida;
    }

    private static String construirDescripcionRuta(
        Ruta ruta
    ) {

        if (ruta == null
            || ruta.vuelos == null
            || ruta.vuelos.isEmpty()) {

            return "";
        }

        return ruta.vuelos.stream()
            .map(ReporteRutas::formatearVuelo)
            .collect(Collectors.joining(" | "));
    }

    private static String formatearVuelo(
        Vuelo vuelo
    ) {

        return vuelo.origen + "->" + vuelo.destino;
    }
}