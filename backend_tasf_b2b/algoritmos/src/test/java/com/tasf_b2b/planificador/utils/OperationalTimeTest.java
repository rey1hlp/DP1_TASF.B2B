package com.tasf_b2b.planificador.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.junit.jupiter.api.Test;

class OperationalTimeTest {
    @Test
    void convertsLocalDateTimeToUtcWithAirportGmt() {
        LocalDateTime local = LocalDateTime.of(2026, 1, 2, 10, 15);

        assertEquals(LocalDateTime.of(2026, 1, 2, 15, 15), OperationalTime.localToUtc(local, -5));
        assertEquals(LocalDateTime.of(2026, 1, 2, 8, 15), OperationalTime.localToUtc(local, 2));
    }

    @Test
    void flightAcrossDifferentGmtsCalculatesUtcDuration() {
        int duration = OperationalTime.durationMinutesBetweenLocalTimes(
            LocalTime.of(10, 0),
            -5,
            LocalTime.of(20, 0),
            2
        );

        assertEquals(180, duration);
    }

    @Test
    void earlyPositiveGmtDepartureCanHaveNegativeUtcOffset() {
        int offset = OperationalTime.localTimeToUtcOffsetMinute(LocalTime.of(1, 30), 2);

        assertEquals(-30, offset);
    }

    @Test
    void arrivalBeforeDepartureLocalClockCrossesDay() {
        int duration = OperationalTime.durationMinutesBetweenLocalTimes(
            LocalTime.of(22, 0),
            -5,
            LocalTime.of(1, 0),
            -5
        );

        assertEquals(180, duration);
    }

    @Test
    void shipmentLocalIngressBecomesAbsoluteUtcMinute() {
        int minute = OperationalTime.absoluteUtcMinute(
            LocalDate.of(2026, 1, 2),
            LocalTime.of(0, 30),
            -5
        );
        int expected = ((int) LocalDate.of(2026, 1, 2).toEpochDay()) * 1440 + 330;

        assertEquals(expected, minute);
    }
}
