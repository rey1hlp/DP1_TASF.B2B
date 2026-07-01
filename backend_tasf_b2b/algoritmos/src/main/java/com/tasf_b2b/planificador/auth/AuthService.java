package com.tasf_b2b.planificador.auth;

import com.tasf_b2b.planificador.auth.AuthDtos.AuthResponse;
import com.tasf_b2b.planificador.auth.AuthDtos.LoginRequest;
import com.tasf_b2b.planificador.persistence.AppUserEntity;
import com.tasf_b2b.planificador.persistence.AppUserRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
        AppUserRepository userRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request != null && request.email != null ? request.email.trim() : "";
        String password = request != null && request.password != null ? request.password : "";

        AppUserEntity user = userRepository.findByEmailIgnoreCaseAndEnabledTrue(email)
            .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!passwordEncoder.matches(password, user.passwordHash)) {
            throw new BadCredentialsException("Invalid credentials");
        }

        user.lastLoginAt = LocalDateTime.now();
        userRepository.save(user);

        AuthResponse response = new AuthResponse();
        response.accessToken = jwtService.generateToken(user);
        response.expiresInSeconds = jwtService.expirationSeconds();
        response.user = AuthMapper.toMeDto(user);
        return response;
    }
}
