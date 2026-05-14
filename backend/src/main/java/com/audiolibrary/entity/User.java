package com.audiolibrary.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {

    private String email;

    private String passwordHash;

    private String firstName;

    private String lastName;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    private Role role;

    // P0: Resume/Continue Listening fields
    @Column(name = "last_played_audio_id")
    private UUID lastPlayedAudioId;

    @Column(name = "last_played_position_seconds")
    private Long lastPlayedPositionSeconds;

    @Column(name = "last_played_at")
    private LocalDateTime lastPlayedAt;

    public enum Role {
        USER, ADMIN, OWNER
    }
}

