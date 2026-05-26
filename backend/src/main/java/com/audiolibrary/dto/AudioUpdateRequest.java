package com.audiolibrary.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class AudioUpdateRequest {
    private String title;
    private String description;
    private String speaker;
    private String topic;
    private String language;
    private List<UUID> genreIds;
    private List<UUID> tagIds;
    private List<UUID> speakerIds;
    private UUID seriesId;
    private Integer seriesOrder;
}
