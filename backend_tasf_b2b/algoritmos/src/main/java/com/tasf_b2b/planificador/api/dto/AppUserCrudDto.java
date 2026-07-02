package com.tasf_b2b.planificador.api.dto;

import com.tasf_b2b.planificador.persistence.AppUserRole;

import java.time.LocalDateTime;

public class AppUserCrudDto {
    public Long id;
    public String email;
    public String password;
    public String fullName;
    public AppUserRole role;
    public Long airportId;
    public String airportCode;
    public String airportName;
    public boolean enabled;
    public LocalDateTime lastLoginAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
