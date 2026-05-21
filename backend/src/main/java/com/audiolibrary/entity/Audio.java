package com.audiolibrary.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "audio_files")
@Getter
@Setter
public class Audio extends BaseEntity {

    private String title;

    private String description;

    @Column(name = "s3_key")
    private String s3Key;

    private String url; // Signed URL or CDN URL

    @Column(name = "storage_key")
    private String storageKey; // Local file storage key (relative path)

    @Column(name = "original_filename")
    private String originalFilename;

    @Column(name = "duration_seconds")
    private Long durationSeconds;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "recorded_at")
    private LocalDateTime recordedAt;

    @Column(name = "recorded_timezone")
    private String recordedTimezone;

    @Enumerated(EnumType.STRING)
    private Status status;

    // P1: Language support
    @Column(length = 10)
    private String language = "en";

    @Column(name = "has_transcript")
    private Boolean hasTranscript = Boolean.FALSE;

    @Column(name = "transcript_url")
    private String transcriptUrl;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "file_hash")
    private String fileHash;

    // P1: Soft delete
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    // Metadata for search (legacy - consider using audio_metadata or tags)
    private String speaker;
    private String topic;


    /* Added Relations important for using searching option */
    @OneToMany(mappedBy = "audio", fetch = FetchType.LAZY)
    private List<AudioSpeakerJoin> audioSpeakers = new ArrayList<>();

    @OneToMany(mappedBy = "audio", fetch = FetchType.LAZY)
    private List<AudioGenreJoin> audioGenres = new ArrayList<>();

    @OneToMany(mappedBy = "audio", fetch = FetchType.LAZY)
    private List<AudioTagJoin> audioTags = new ArrayList<>();

    public enum MediaType {
        AUDIO,
        VIDEO
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type")
    private MediaType mediaType = MediaType.AUDIO;

    public enum Status {
        DRAFT,
        PUBLISHED,
        ARCHIVED
    }

    /**
     * Check if this is a video file.
     */
    public boolean isVideo() {
        return mediaType == MediaType.VIDEO;
    }

    /**
     * Check if this audio is soft-deleted.
     */
    public boolean isDeleted() {
        return deletedAt != null;
    }

    /**
     * Soft delete this audio.
     */
    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    /**
     * Restore a soft-deleted audio.
     */
    public void restore() {
        this.deletedAt = null;
    }
}