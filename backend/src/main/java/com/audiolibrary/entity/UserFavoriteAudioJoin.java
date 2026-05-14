package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Join table entity linking Users to their favorite Audio files (many-to-many).
 */
@Entity
@Table(name = "user_favorite_audio")
@Getter
@Setter
public class UserFavoriteAudioJoin {

    @EmbeddedId
    private UserFavoriteAudioJoinId id = new UserFavoriteAudioJoinId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("audioId")
    @JoinColumn(name = "audio_id", nullable = false)
    private Audio audio;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}





