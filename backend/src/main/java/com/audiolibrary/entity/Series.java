package com.audiolibrary.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A Series groups related audio/video content in an ordered collection.
 * Examples: podcast series, lecture course, sermon collection, album.
 *
 * Relationship: Series (1) → Audio (many) via audio_files.series_id FK.
 */
@Entity
@Table(name = "series")
@Getter
@Setter
public class Series extends BaseEntity {

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "speaker_id", insertable = false, updatable = false)
    private Speaker speaker;

    @Column(name = "speaker_id")
    private UUID speakerId;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /**
     * Check if this series is soft-deleted.
     */
    public boolean isDeleted() {
        return deletedAt != null;
    }

    /**
     * Soft delete this series.
     */
    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    /**
     * Restore a soft-deleted series.
     */
    public void restore() {
        this.deletedAt = null;
    }
}