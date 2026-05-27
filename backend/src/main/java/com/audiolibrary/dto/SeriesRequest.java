package com.audiolibrary.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class SeriesRequest {
    private String name;
    private String description;
    private UUID speakerId;
    private String coverImageUrl;
}
