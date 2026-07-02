package com.tasf_b2b.planificador.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUserEntity, Long> {
    Optional<AppUserEntity> findByEmailIgnoreCase(String email);

    Optional<AppUserEntity> findByEmailIgnoreCaseAndEnabledTrue(String email);
}
