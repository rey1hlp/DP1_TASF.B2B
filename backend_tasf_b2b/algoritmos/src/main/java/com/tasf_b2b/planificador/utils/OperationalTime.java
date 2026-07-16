package com.tasf_b2b.planificador.utils;

import com.tasf_b2b.planificador.auth.AuthenticatedUser;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

public final class OperationalTime {
    public static final String DEFAULT_OPERATION_ZONE_ID = "America/Lima";
    public static final int DEFAULT_OPERATION_GMT = -5;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    private OperationalTime() {
    }

    public static ZoneId resolveFallbackOperationalZone() {
        return ZoneId.of(DEFAULT_OPERATION_ZONE_ID);
    }

    public static LocalDateTime localToUtc(LocalDateTime localDateTime, int gmtHours) {
        return localDateTime.minusHours(gmtHours);
    }

    public static LocalDateTime utcToLocal(LocalDateTime utcDateTime, int gmtHours) {
        return utcDateTime.plusHours(gmtHours);
    }

    public static Optional<AirportEntity> resolveUserOperationalAirport(
        AuthenticatedUser user,
        AirportRepository airportRepository
    ) {
        if (user == null || user.airportCode() == null || user.airportCode().isBlank() || airportRepository == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(airportRepository.findByCodigoOaci(user.airportCode().trim().toUpperCase()));
    }

    public static int toMinuteOfDay(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }

    public static int localTimeToUtcOffsetMinute(LocalTime localTime, int gmtHours) {
        return toMinuteOfDay(localTime) - (gmtHours * 60);
    }

    public static int durationMinutesBetweenLocalTimes(
        LocalTime salidaLocal,
        int origenGmt,
        LocalTime llegadaLocal,
        int destinoGmt
    ) {
        int salidaUtcOffset = localTimeToUtcOffsetMinute(salidaLocal, origenGmt);
        int llegadaLocalDayOffset = llegadaLocal.isBefore(salidaLocal) ? 1440 : 0;
        int llegadaUtcOffset = llegadaLocalDayOffset + localTimeToUtcOffsetMinute(llegadaLocal, destinoGmt);
        while (llegadaUtcOffset <= salidaUtcOffset) {
            llegadaUtcOffset += 1440;
        }
        return llegadaUtcOffset - salidaUtcOffset;
    }

    public static int absoluteUtcMinute(LocalDateTime utcDateTime) {
        int dayIndex = (int) utcDateTime.toLocalDate().toEpochDay();
        return dayIndex * 1440 + utcDateTime.getHour() * 60 + utcDateTime.getMinute();
    }

    public static int absoluteUtcMinute(LocalDate localDate, LocalTime localTime, int gmtHours) {
        return absoluteUtcMinute(localToUtc(LocalDateTime.of(localDate, localTime), gmtHours));
    }

    public static String dateKeyFromUtc(LocalDateTime utcDateTime, int gmtHours) {
        return utcToLocal(utcDateTime, gmtHours).toLocalDate().format(DATE_FORMAT);
    }
}
