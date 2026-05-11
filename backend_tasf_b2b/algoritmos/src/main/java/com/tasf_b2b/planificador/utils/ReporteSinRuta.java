package com.tasf_b2b.planificador.utils;

import com.tasf_b2b.planificador.dominio.Envio;
import com.tasf_b2b.planificador.nucleo.Individuo;
import com.tasf_b2b.planificador.nucleo.Ruta;

import java.io.FileWriter;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public class ReporteSinRuta {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    public static Path escribirReporte(Path raizProyecto, List<Envio> envios, Individuo individuo, String etiqueta) throws java.io.IOException {
        if (envios == null || envios.isEmpty() || individuo == null || individuo.asignaciones == null) return null;

        int sinRuta = 0;
        for (int i = 0; i < envios.size(); i++) {
            Ruta r = individuo.asignaciones[i];
            if (r == null || r.vuelos == null || r.vuelos.isEmpty()) sinRuta++;
        }
        if (sinRuta == 0) return null;

        String ts = LocalDateTime.now().format(TS_FORMAT);
        String nombre = ts + "-report.csv";
        Path dir = raizProyecto.resolve("tmp_run");
        Files.createDirectories(dir);
        Path salida = dir.resolve(nombre);

        boolean incluirEtiqueta = etiqueta != null && !etiqueta.isBlank();

        try (PrintWriter pw = new PrintWriter(new FileWriter(salida.toFile()))) {
            pw.print("id_pedido,origen,destino,fecha,hora,cantidad,id_cliente,sla_horas");
            if (incluirEtiqueta) pw.print(",etiqueta");
            pw.println();

            for (int i = 0; i < envios.size(); i++) {
                Envio e = envios.get(i);
                Ruta r = individuo.asignaciones[i];
                if (r == null || r.vuelos == null || r.vuelos.isEmpty()) {
                    String hora = UtilArchivos.formatearHora(e.horaIngresoLocal);
                    if (incluirEtiqueta) {
                        pw.printf("%s,%s,%s,%s,%s,%d,%s,%d,%s%n",
                            e.idPedido, e.origen, e.destino, e.fecha, hora, e.cantidad, e.idCliente, e.slaHoras, etiqueta);
                    } else {
                        pw.printf("%s,%s,%s,%s,%s,%d,%s,%d%n",
                            e.idPedido, e.origen, e.destino, e.fecha, hora, e.cantidad, e.idCliente, e.slaHoras);
                    }
                }
            }
        }

        return salida;
    }
}
