package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter
@Setter
public class RecommendationCacheId implements Serializable {

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "audio_id")
    private UUID audioId;
}


