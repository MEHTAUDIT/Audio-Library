package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * Join table entity linking Audio to Speakers (many-to-many).
 * Includes additional metadata like role and display order.
 */
@Entity
@Table(name = "audio_speakers")
@Getter
@Setter
public class AudioSpeakerJoin {

    @EmbeddedId
    private AudioSpeakerJoinId id = new AudioSpeakerJoinId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("audioId")
    @JoinColumn(name = "audio_id", nullable = false)
    private Audio audio;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("speakerId")
    @JoinColumn(name = "speaker_id", nullable = false)
    private Speaker speaker;

    @Enumerated(EnumType.STRING)
    private Role role = Role.SPEAKER;

    @Column(name = "display_order")
    private Integer displayOrder;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum Role {
        SPEAKER,
        HOST,
        GUEST,
        OTHER
    }
}





