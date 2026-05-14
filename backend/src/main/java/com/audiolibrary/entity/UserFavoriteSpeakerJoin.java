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
 * Join table entity linking Users to their favorite Speakers (many-to-many).
 * Includes notification preference for new audio from the speaker.
 */
@Entity
@Table(name = "user_favorite_speaker")
@Getter
@Setter
public class UserFavoriteSpeakerJoin {

    @EmbeddedId
    private UserFavoriteSpeakerJoinId id = new UserFavoriteSpeakerJoinId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("speakerId")
    @JoinColumn(name = "speaker_id", nullable = false)
    private Speaker speaker;

    @Column(name = "notify_on_new_audio")
    private Boolean notifyOnNewAudio = Boolean.TRUE;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}





