package com.tasf_b2b.planificador.auth;

import com.tasf_b2b.planificador.auth.AuthDtos.UserMeDto;
import com.tasf_b2b.planificador.persistence.AppUserEntity;

public final class AuthMapper {
    private AuthMapper() {
    }

    public static UserMeDto toMeDto(AppUserEntity user) {
        UserMeDto dto = new UserMeDto();
        dto.id = user.id;
        dto.email = user.email;
        dto.fullName = user.fullName;
        dto.role = user.role;
        dto.airportId = user.airport != null ? user.airport.id : null;
        dto.airportCode = user.airport != null ? user.airport.codigoOaci : null;
        return dto;
    }

    public static UserMeDto toMeDto(AuthenticatedUser user) {
        UserMeDto dto = new UserMeDto();
        dto.id = user.id();
        dto.email = user.email();
        dto.fullName = user.fullName();
        dto.role = user.role();
        dto.airportId = user.airportId();
        dto.airportCode = user.airportCode();
        return dto;
    }
}
