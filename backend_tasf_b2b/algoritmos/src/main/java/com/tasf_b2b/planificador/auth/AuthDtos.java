package com.tasf_b2b.planificador.auth;

import com.tasf_b2b.planificador.persistence.AppUserRole;

public class AuthDtos {
    public static class LoginRequest {
        public String email;
        public String password;
    }

    public static class AuthResponse {
        public String accessToken;
        public String tokenType = "Bearer";
        public long expiresInSeconds;
        public UserMeDto user;
    }

    public static class UserMeDto {
        public Long id;
        public String email;
        public String fullName;
        public AppUserRole role;
        public Long airportId;
        public String airportCode;
    }
}
