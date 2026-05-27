package com.audiolibrary.dto;

import com.audiolibrary.entity.Series;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class SeriesResponse {
    private UUID id;
    private String name;
    private String description;
    private String coverImageUrl;
    private UUID speakerId;
    private String speakerName;
    private int audioCount;
    private long totalDurationSeconds;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<AudioResponse> audioItems;

    /**
     * Map entity to response (without audio items — use for list views).
     */
    public static SeriesResponse fromEntity(Series series) {
        return SeriesResponse.builder()
                .id(series.getId())
                .name(series.getName())
                .description(series.getDescription())
                .coverImageUrl(series.getCoverImageUrl())
                .speakerId(series.getSpeakerId())
                .speakerName(series.getSpeaker() != null ? series.getSpeaker().getName() : null)
                .audioCount(0)
                .totalDurationSeconds(0)
                .createdAt(series.getCreatedAt())
                .updatedAt(series.getUpdatedAt())
                .build();
    }
}