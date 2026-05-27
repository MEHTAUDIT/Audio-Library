package com.audiolibrary.dto;

import com.audiolibrary.entity.Audio;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AudioResponse {
    private UUID id;
    private String title;
    private String description;
    private String speaker;
    private String topic;
    private String language;
    private Long durationSeconds;
    private String mimeType;
    private Long sizeBytes;
    private String url;
    private String originalFilename;
    private String status;
    private Audio.MediaType mediaType;
    private UUID seriesId;
    private String seriesName;
    private Integer seriesOrder;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<GenreResponse> genres;
    private List<TagResponse> tags;
    private List<SpeakerResponse> speakers;

    public static AudioResponse fromEntity(Audio audio) {
        return AudioResponse.builder()
                .id(audio.getId())
                .title(audio.getTitle())
                .description(audio.getDescription())
                .speaker(audio.getSpeaker())
                .topic(audio.getTopic())
                .language(audio.getLanguage())
                .durationSeconds(audio.getDurationSeconds())
                .mimeType(audio.getMimeType())
                .sizeBytes(audio.getSizeBytes())
                .url(audio.getUrl())
                .originalFilename(audio.getOriginalFilename())
                .status(audio.getStatus() != null ? audio.getStatus().name() : null)
                .mediaType(audio.getMediaType() != null ? audio.getMediaType() : Audio.MediaType.AUDIO)
                .seriesId(audio.getSeriesId())
                .seriesName(audio.getSeries() != null ? audio.getSeries().getName() : null)
                .seriesOrder(audio.getSeriesOrder())
                .publishedAt(audio.getPublishedAt())
                .createdAt(audio.getCreatedAt())
                .updatedAt(audio.getUpdatedAt())
                .build();
    }

    @Data
    @Builder
    public static class GenreResponse {
        private UUID id;
        private String name;
    }

    @Data
    @Builder
    public static class TagResponse {
        private UUID id;
        private String name;
        private String slug;
        private String color;
    }

    @Data
    @Builder
    public static class SpeakerResponse {
        private UUID id;
        private String name;
        private String avatarUrl;
    }


    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpeakerProfileResponse {
        private UUID speakerId;
        private String name;
        private String bio;
        private String websiteUrl;
        private String profileImageUrl;
        private Long totalAudioCount;
        private List<AudioResponse> audios;
    }
}