package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.AppUserCrudDto;
import com.tasf_b2b.planificador.auth.AuthenticatedUser;
import com.tasf_b2b.planificador.persistence.AppUserEntity;
import com.tasf_b2b.planificador.persistence.AppUserRepository;
import com.tasf_b2b.planificador.persistence.AppUserRole;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private static final Logger log = LoggerFactory.getLogger(AdminUserController.class);

    private final AppUserRepository userRepository;
    private final AirportRepository airportRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminUserController(
        AppUserRepository userRepository,
        AirportRepository airportRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.airportRepository = airportRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public ResponseEntity<List<AppUserCrudDto>> list() {
        return ResponseEntity.ok(
            userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList()
        );
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody AppUserCrudDto dto) {
        log.info("[ADMIN_USER] create request email={} role={} airportCode={}", dto != null ? dto.email : null, dto != null ? dto.role : null, dto != null ? dto.airportCode : null);
        try {
            ValidationResult validation = validate(dto, true);
            if (!validation.ok) {
                return ResponseEntity.badRequest().body(validation.message);
            }
            if (userRepository.findByEmailIgnoreCase(dto.email.trim()).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Ya existe un usuario con ese email");
            }

            AppUserEntity entity = new AppUserEntity();
            apply(entity, dto, true);
            AppUserEntity saved = userRepository.save(entity);
            log.info("[ADMIN_USER] create saved id={} email={} role={}", saved.id, saved.email, saved.role);
            return ResponseEntity.ok(toDto(saved));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (DataIntegrityViolationException ex) {
            log.error("[ADMIN_USER] create integrity error", ex);
            return ResponseEntity.badRequest().body("No se pudo crear el empleado por una restriccion de base de datos");
        } catch (RuntimeException ex) {
            log.error("[ADMIN_USER] create unexpected error", ex);
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody AppUserCrudDto dto) {
        log.info("[ADMIN_USER] update request id={} email={} role={} airportCode={}", id, dto != null ? dto.email : null, dto != null ? dto.role : null, dto != null ? dto.airportCode : null);
        AppUserEntity entity = userRepository.findById(id).orElse(null);
        if (entity == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Usuario no encontrado");
        }
        try {
            ValidationResult validation = validate(dto, false);
            if (!validation.ok) {
                return ResponseEntity.badRequest().body(validation.message);
            }
            Optional<AppUserEntity> duplicate = userRepository.findByEmailIgnoreCase(dto.email.trim());
            if (duplicate.isPresent() && !Objects.equals(duplicate.get().id, id)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Ya existe un usuario con ese email");
            }

            apply(entity, dto, false);
            AppUserEntity saved = userRepository.save(entity);
            log.info("[ADMIN_USER] update saved id={} email={} role={} enabled={}", saved.id, saved.email, saved.role, saved.enabled);
            return ResponseEntity.ok(toDto(saved));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (DataIntegrityViolationException ex) {
            log.error("[ADMIN_USER] update integrity error", ex);
            return ResponseEntity.badRequest().body("No se pudo actualizar el empleado por una restriccion de base de datos");
        } catch (RuntimeException ex) {
            log.error("[ADMIN_USER] update unexpected error", ex);
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        AppUserEntity entity = userRepository.findById(id).orElse(null);
        if (entity == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Usuario no encontrado");
        }
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        if (principal instanceof AuthenticatedUser auth && Objects.equals(auth.id(), id)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("No puedes eliminar tu propio usuario");
        }
        log.info("[ADMIN_USER] delete id={} email={} role={}", entity.id, entity.email, entity.role);
        userRepository.delete(entity);
        return ResponseEntity.ok().build();
    }

    private AppUserCrudDto toDto(AppUserEntity entity) {
        AppUserCrudDto dto = new AppUserCrudDto();
        dto.id = entity.id;
        dto.email = entity.email;
        dto.fullName = entity.fullName;
        dto.role = entity.role;
        dto.airportId = entity.airport != null ? entity.airport.id : null;
        dto.airportCode = entity.airport != null ? entity.airport.codigoOaci : null;
        dto.airportName = entity.airport != null ? entity.airport.nombre : null;
        dto.enabled = entity.enabled;
        dto.lastLoginAt = entity.lastLoginAt;
        dto.createdAt = entity.createdAt;
        dto.updatedAt = entity.updatedAt;
        return dto;
    }

    private void apply(AppUserEntity entity, AppUserCrudDto dto, boolean isCreate) {
        entity.email = dto.email.trim().toLowerCase(Locale.ROOT);
        entity.fullName = dto.fullName != null ? dto.fullName.trim() : "";
        entity.role = dto.role;
        entity.enabled = dto.enabled;
        entity.airport = resolveAirport(dto);
        if (dto.password != null && !dto.password.isBlank()) {
            entity.passwordHash = passwordEncoder.encode(dto.password);
        } else if (isCreate) {
            throw new IllegalArgumentException("La contraseña es obligatoria");
        }
    }

    private AirportEntity resolveAirport(AppUserCrudDto dto) {
        if (dto.role == AppUserRole.ADMIN) {
            return null;
        }
        String code = dto.airportCode != null ? dto.airportCode.trim().toUpperCase(Locale.ROOT) : "";
        if (code.isBlank()) {
            throw new IllegalArgumentException("El aeropuerto es obligatorio para este rol");
        }
        AirportEntity airport = airportRepository.findByCodigoOaci(code);
        if (airport == null) {
            throw new IllegalArgumentException("Aeropuerto no encontrado");
        }
        return airport;
    }

    private ValidationResult validate(AppUserCrudDto dto, boolean isCreate) {
        if (dto == null) {
            return ValidationResult.fail("Datos inválidos");
        }
        if (dto.email == null || dto.email.isBlank()) {
            return ValidationResult.fail("El email es obligatorio");
        }
        if (dto.fullName == null || dto.fullName.isBlank()) {
            return ValidationResult.fail("El nombre es obligatorio");
        }
        if (dto.role == null) {
            return ValidationResult.fail("El rol es obligatorio");
        }
        if (dto.role == AppUserRole.ADMIN && dto.airportCode != null && !dto.airportCode.isBlank()) {
            return ValidationResult.fail("El rol ADMIN no debe tener aeropuerto");
        }
        if (dto.role != AppUserRole.ADMIN && (dto.airportCode == null || dto.airportCode.isBlank())) {
            return ValidationResult.fail("El aeropuerto es obligatorio para este rol");
        }
        if (isCreate && (dto.password == null || dto.password.isBlank())) {
            return ValidationResult.fail("La contraseña es obligatoria");
        }
        return ValidationResult.ok();
    }

    private static final class ValidationResult {
        final boolean ok;
        final String message;

        private ValidationResult(boolean ok, String message) {
            this.ok = ok;
            this.message = message;
        }

        static ValidationResult ok() {
            return new ValidationResult(true, null);
        }

        static ValidationResult fail(String message) {
            return new ValidationResult(false, message);
        }
    }
}
