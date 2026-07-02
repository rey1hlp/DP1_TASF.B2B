package com.tasf_b2b.planificador.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")
public class AppUserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "email", length = 160, nullable = false, unique = true)
    public String email;

    @Column(name = "password_hash", length = 255, nullable = false)
    public String passwordHash;

    @Column(name = "full_name", length = 120, nullable = false)
    public String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 20, nullable = false)
    public AppUserRole role;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "airport_id")
    public AirportEntity airport;

    @Column(name = "enabled", nullable = false)
    public boolean enabled = true;

    @Column(name = "last_login_at")
    public LocalDateTime lastLoginAt;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
