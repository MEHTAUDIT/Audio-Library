package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_preferences")
@Getter
@Setter
public class UserPreferences {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "preferred_playback_speed")
    private BigDecimal preferredPlaybackSpeed = BigDecimal.ONE;

    @Column(name = "auto_play_next")
    private Boolean autoPlayNext = Boolean.TRUE;

    @Column(name = "email_notifications")
    private Boolean emailNotifications = Boolean.TRUE;

    @Column(name = "push_notifications")
    private Boolean pushNotifications = Boolean.TRUE;

    @Column(name = "preferred_language")
    private String preferredLanguage;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_audio_length")
    private AudioLength preferredAudioLength = AudioLength.ANY;

    @Enumerated(EnumType.STRING)
    private Theme theme = Theme.SYSTEM;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum AudioLength {
        SHORT,      // < 15 min
        MEDIUM,     // 15-45 min
        LONG,       // > 45 min
        ANY
    }

    public enum Theme {
        LIGHT,
        DARK,
        SYSTEM
    }
}

