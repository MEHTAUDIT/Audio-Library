package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class AudioSpeakerJoinId implements Serializable {

    @Column(name = "audio_id")
    private UUID audioId;

    @Column(name = "speaker_id")
    private UUID speakerId;
}





