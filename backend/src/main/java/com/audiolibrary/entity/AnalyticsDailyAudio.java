package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "analytics_daily_audio")
@Getter
@Setter
public class AnalyticsDailyAudio {

    @EmbeddedId
    private AnalyticsDailyAudioId id = new AnalyticsDailyAudioId();

    private Long plays = 0L;

    private Long listeners = 0L;

    @Column(name = "total_seconds_listened")
    private Long totalSecondsListened = 0L;
}


