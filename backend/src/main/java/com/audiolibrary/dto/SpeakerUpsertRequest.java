package com.audiolibrary.dto;

import lombok.Data;

@Data
public class SpeakerUpsertRequest {
    private String name;
    private String bio;
    private String websiteUrl;
    private String profileImageUrl;
}