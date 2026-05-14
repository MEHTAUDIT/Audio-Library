package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.UUID;

@Embeddable
@Getter
@Setter
public class AnalyticsDailyAudioId implements Serializable {

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "audio_id")
    private UUID audioId;
}


