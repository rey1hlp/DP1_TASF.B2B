package com.tasf_b2b.planificador.auth;

import com.tasf_b2b.planificador.persistence.AppUserEntity;
import com.tasf_b2b.planificador.persistence.AppUserRole;

public record AuthenticatedUser(
    Long id,
    String email,
    String fullName,
    AppUserRole role,
    Long airportId,
    String airportCode
) {
    public static AuthenticatedUser from(AppUserEntity user) {
        Long airportId = user.airport != null ? user.airport.id : null;
        String airportCode = user.airport != null ? user.airport.codigoOaci : null;
        return new AuthenticatedUser(
            user.id,
            user.email,
            user.fullName,
            user.role,
            airportId,
            airportCode
        );
    }
}
