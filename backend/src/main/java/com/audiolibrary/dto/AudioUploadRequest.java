package com.audiolibrary.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class AudioUploadRequest {
    private String title;
    private String description;
    private String speaker;
    private UUID speakerId;
    private String topic;
    private String language;
    private Long durationSeconds;
    private String mimeType;
    private Long sizeBytes;
}

