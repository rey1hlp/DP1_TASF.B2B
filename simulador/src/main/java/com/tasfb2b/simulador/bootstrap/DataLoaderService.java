package com.tasfb2b.simulador.bootstrap;

import com.tasfb2b.simulador.domain.enums.EstadoEquipaje;
import com.tasfb2b.simulador.domain.logistica.Aeropuerto;
import com.tasfb2b.simulador.domain.logistica.Vuelo;
import com.tasfb2b.simulador.domain.operaciones.Equipaje;
import com.tasfb2b.simulador.repository.AeropuertoRepository;
import com.tasfb2b.simulador.repository.EquipajeRepository;
import com.tasfb2b.simulador.repository.VueloRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class DataLoaderService {

    private static final String DATA_ROOT = "data";
    private static final String AIRPORTS_FILE = "c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt";
    private static final String FLIGHTS_FILE = "planes_vuelo.txt";
    private static final String SHIPMENTS_DIR = "_envios_preliminar_";
    private static final DateTimeFormatter SHIPMENT_DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    private final AeropuertoRepository aeropuertoRepository;
    private final VueloRepository vueloRepository;
    private final EquipajeRepository equipajeRepository;

    public DataLoaderService(
            AeropuertoRepository aeropuertoRepository,
            VueloRepository vueloRepository,
            EquipajeRepository equipajeRepository
    ) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.vueloRepository = vueloRepository;
        this.equipajeRepository = equipajeRepository;
    }

    @Transactional
    public DataLoadSummary loadAllData() {
        return loadAirportsAndFlightsOnly();
    }

    @Transactional
    public DataLoadSummary loadAirportsAndFlightsOnly() {
        int aeropuertos = loadAirports();
        int vuelos = loadFlights();
        return new DataLoadSummary(aeropuertos, vuelos, 0);
    }

    @Transactional
    public DataLoadSummary loadShipmentsOnly() {
        int envios = loadShipments();
        return new DataLoadSummary(0, 0, envios);
    }

    @Transactional
    public DataLoadSummary loadShipmentsByFile(String fileName, Integer maxRows) {
        String resolved = resolveShipmentFileName(fileName);
        int envios = loadShipmentFile(resolved, normalizeLimit(maxRows));
        return new DataLoadSummary(0, 0, envios);
    }

    @Transactional
    public DataLoadSummary loadAllShipmentsFromFolder() {
        int envios = loadShipments();
        return new DataLoadSummary(0, 0, envios);
    }

    @Transactional
    public int deleteAllShipments() {
        int total = (int) equipajeRepository.count();
        equipajeRepository.deleteAllInBatch();
        return total;
    }

    private int loadAirports() {
        List<String> lines = readResourceLines(path(DATA_ROOT, AIRPORTS_FILE), StandardCharsets.UTF_16LE);
        int count = 0;
        for (String line : lines) {
            String normalized = line.replace('\u0000', ' ').replace("\uFEFF", "").trim();
            if (normalized.isBlank()) {
                continue;
            }
            String compact = normalized.replaceAll("\\s+", " ").trim();
            if (!startsWithDigit(compact)) {
                continue;
            }
            String[] tokens = compact.split(" ");
            if (tokens.length < 7) {
                continue;
            }
            String code = tokens[1].toUpperCase(Locale.ROOT);
            if (code.length() != 4) {
                continue;
            }
            String gmtToken = findToken(tokens, "^[+-]\\d+$").orElse("+0");
            String capacidadToken = findToken(tokens, "^\\d{3}$").orElse("400");

            int startCity = 2;
            int endCity = indexOf(tokens, gmtToken) - 3;
            if (endCity < startCity) {
                continue;
            }
            StringBuilder cityBuilder = new StringBuilder();
            for (int i = startCity; i <= endCity; i++) {
                if (!tokens[i].matches("[A-Za-zÁÉÍÓÚáéíóúñÑ.]+")) {
                    break;
                }
                if (cityBuilder.length() > 0) {
                    cityBuilder.append(' ');
                }
                cityBuilder.append(tokens[i]);
            }
            String ciudad = cityBuilder.toString().trim();
            if (ciudad.isBlank()) {
                ciudad = code;
            }
            String pais = tokens[Math.min(tokens.length - 1, Math.max(startCity + 1, endCity + 1))];
            int aforo = Integer.parseInt(capacidadToken);
            String huso = "GMT" + gmtToken;

            Aeropuerto aeropuerto = aeropuertoRepository.findById(code).orElseGet(Aeropuerto::new);
            aeropuerto.setCodigoOaci(code);
            aeropuerto.setCiudad(ciudad);
            aeropuerto.setPais(pais);
            aeropuerto.setHusoHorario(huso);
            aeropuerto.setAforoMaximo(aforo);
            if (aeropuerto.getOcupacionActual() <= 0) {
                aeropuerto.setOcupacionActual(0);
            }
            aeropuertoRepository.save(aeropuerto);
            count++;
        }
        return count;
    }

    private int loadFlights() {
        List<String> lines = readResourceLines(path(DATA_ROOT, FLIGHTS_FILE), StandardCharsets.UTF_8);
        int count = 0;
        int idx = 1;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) {
                continue;
            }
            String[] parts = trimmed.split("-");
            if (parts.length != 5) {
                continue;
            }
            String origenCode = parts[0].toUpperCase(Locale.ROOT);
            String destinoCode = parts[1].toUpperCase(Locale.ROOT);
            LocalTime salida = parseHour(parts[2]);
            LocalTime llegada = parseHour(parts[3]);
            int capacidad = Integer.parseInt(parts[4]);

            Aeropuerto origen = ensureAirport(origenCode);
            Aeropuerto destino = ensureAirport(destinoCode);

            LocalDate base = LocalDate.of(2026, 1, 1);
            LocalDateTime horaSalida = LocalDateTime.of(base, salida);
            LocalDateTime horaLlegada = LocalDateTime.of(base, llegada);
            if (horaLlegada.isBefore(horaSalida)) {
                horaLlegada = horaLlegada.plusDays(1);
            }

            String idVuelo = String.format("FL-%s-%s-%05d", origenCode, destinoCode, idx++);
            Vuelo vuelo = vueloRepository.findById(idVuelo).orElseGet(Vuelo::new);
            vuelo.setIdVuelo(idVuelo);
            vuelo.setOrigen(origen);
            vuelo.setDestino(destino);
            vuelo.setHoraSalida(horaSalida);
            vuelo.setHoraLlegada(horaLlegada);
            vuelo.setCapacidadMaxima(capacidad);
            vuelo.setEquipajeAsignado(Math.max(vuelo.getEquipajeAsignado(), 0));
            if (vuelo.getEstado() == null || vuelo.getEstado().isBlank()) {
                vuelo.setEstado("PROGRAMADO");
            }
            vueloRepository.save(vuelo);
            count++;
        }
        return count;
    }

    private int loadShipments() {
        return loadShipments(listShipmentFiles(), null);
    }

    private int loadShipments(List<String> files, Integer maxRowsPerFile) {
        int count = 0;
        for (String shipmentFile : files) {
            count += loadShipmentFile(shipmentFile, maxRowsPerFile);
        }
        return count;
    }

    private int loadShipmentFile(String shipmentFile, Integer maxRows) {
        String originCode = extractOriginCode(shipmentFile);
        Aeropuerto origen = ensureAirport(originCode);
        List<String> lines = readResourceLines(path(DATA_ROOT, SHIPMENTS_DIR, shipmentFile), StandardCharsets.UTF_8);
        int count = 0;
        for (String line : lines) {
            if (maxRows != null && count >= maxRows) {
                break;
            }
            String trimmed = line.trim();
            if (trimmed.isBlank()) {
                continue;
            }
            String[] parts = trimmed.split("-");
            if (parts.length != 7) {
                continue;
            }
            String idEnvio = parts[0];
            LocalDate fecha = parseShipmentDate(parts[1]);
            int hour = Integer.parseInt(parts[2]);
            int minute = Integer.parseInt(parts[3]);
            String destinoCode = parts[4].toUpperCase(Locale.ROOT);
            int cantidad = Integer.parseInt(parts[5]);
            String idCliente = parts[6];

            Aeropuerto destino = ensureAirport(destinoCode);
            Equipaje equipaje = equipajeRepository.findById(idEnvio).orElseGet(Equipaje::new);
            equipaje.setIdEnvio(idEnvio);
            equipaje.setIdCliente(idCliente);
            equipaje.setFechaRegistro(LocalDateTime.of(fecha, LocalTime.of(hour, minute)));
            equipaje.setCantidad(cantidad);
            equipaje.setOrigen(origen);
            equipaje.setDestino(destino);
            if (equipaje.getEstado() == null) {
                equipaje.setEstado(EstadoEquipaje.ESPERA);
            }
            equipajeRepository.save(equipaje);
            count++;
        }
        return count;
    }

    private Aeropuerto ensureAirport(String code) {
        return aeropuertoRepository.findById(code).orElseGet(() -> {
            Aeropuerto aeropuerto = new Aeropuerto();
            aeropuerto.setCodigoOaci(code);
            aeropuerto.setCiudad(code);
            aeropuerto.setPais("N/A");
            aeropuerto.setHusoHorario("GMT+0");
            aeropuerto.setAforoMaximo(400);
            aeropuerto.setOcupacionActual(0);
            return aeropuertoRepository.save(aeropuerto);
        });
    }

    private List<String> listShipmentFiles() {
        try {
            List<String> result = new ArrayList<>();
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath*:" + DATA_ROOT + "/" + SHIPMENTS_DIR + "/*.txt");
            for (Resource file : resources) {
                String fileName = file.getFilename();
                if (fileName != null && fileName.toLowerCase(Locale.ROOT).endsWith(".txt")) {
                    result.add(fileName);
                }
            }
            result.sort(Comparator.naturalOrder());
            return result;
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo listar archivos de envíos", ex);
        }
    }

    private String extractOriginCode(String shipmentFile) {
        String name = shipmentFile.replace("_envios_", "").replace("_.txt", "");
        return name.toUpperCase(Locale.ROOT);
    }

    private String resolveShipmentFileName(String fileName) {
        List<String> files = listShipmentFiles();
        String requested = fileName == null ? "" : fileName.trim();
        if (requested.isBlank()) {
            throw new IllegalArgumentException("Debe indicar un nombre de archivo");
        }

        if (files.contains(requested)) {
            return requested;
        }

        String withTxt = requested.toLowerCase(Locale.ROOT).endsWith(".txt") ? requested : requested + ".txt";
        if (files.contains(withTxt)) {
            return withTxt;
        }

        String upperCode = requested
                .replace("_envios_", "")
                .replace("_.txt", "")
                .replace(".txt", "")
                .toUpperCase(Locale.ROOT);
        String canonical = "_envios_" + upperCode + "_.txt";
        if (files.contains(canonical)) {
            return canonical;
        }

        throw new IllegalArgumentException("Archivo de envíos no encontrado: " + fileName);
    }

    private Integer normalizeLimit(Integer maxRows) {
        if (maxRows == null) {
            return null;
        }
        if (maxRows <= 0) {
            throw new IllegalArgumentException("El límite de filas debe ser mayor que cero");
        }
        return maxRows;
    }

    private LocalDate parseShipmentDate(String rawDate) {
        try {
            return LocalDate.parse(rawDate, SHIPMENT_DATE_FORMAT);
        } catch (DateTimeParseException ex) {
            try {
                return LocalDate.parse(rawDate);
            } catch (DateTimeParseException ignored) {
                throw new IllegalArgumentException("Formato de fecha inválido en envío: " + rawDate, ex);
            }
        }
    }

    private List<String> readResourceLines(String resourcePath, Charset charset) {
        Resource resource = new ClassPathResource(resourcePath);
        if (!resource.exists()) {
            return List.of();
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream(), charset))) {
            return reader.lines().toList();
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo leer recurso: " + resourcePath, ex);
        }
    }

    private static String path(String... parts) {
        return String.join("/", parts);
    }

    private static boolean startsWithDigit(String input) {
        return !input.isEmpty() && Character.isDigit(input.charAt(0));
    }

    private static Optional<String> findToken(String[] tokens, String regex) {
        for (String token : tokens) {
            if (token.matches(regex)) {
                return Optional.of(token);
            }
        }
        return Optional.empty();
    }

    private static int indexOf(String[] tokens, String value) {
        for (int i = 0; i < tokens.length; i++) {
            if (tokens[i].equals(value)) {
                return i;
            }
        }
        return -1;
    }

    private static LocalTime parseHour(String hhmm) {
        String[] split = hhmm.split(":");
        return LocalTime.of(Integer.parseInt(split[0]), Integer.parseInt(split[1]));
    }
}
