package com.audiolibrary.repository;

import com.audiolibrary.entity.AudioSpeakerJoin;
import com.audiolibrary.entity.AudioSpeakerJoinId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AudioSpeakerJoinRepository extends JpaRepository<AudioSpeakerJoin, AudioSpeakerJoinId> {

    /**
     * Find all speakers for an audio.
     */
    @Query("SELECT asj FROM AudioSpeakerJoin asj JOIN FETCH asj.speaker WHERE asj.audio.id = :audioId ORDER BY asj.displayOrder")
    List<AudioSpeakerJoin> findAllByAudioId(@Param("audioId") UUID audioId);

    /**
     * Find all audio for a speaker.
     */
    @Query("SELECT asj FROM AudioSpeakerJoin asj JOIN FETCH asj.audio WHERE asj.speaker.id = :speakerId")
    List<AudioSpeakerJoin> findAllBySpeakerId(@Param("speakerId") UUID speakerId);

    /**
     * Delete all speakers for an audio.
     */
    void deleteAllByAudioId(UUID audioId);

    /**
     * Check if audio has a specific speaker.
     */
    boolean existsByAudioIdAndSpeakerId(UUID audioId, UUID speakerId);

    /**
     * Count audio files for a speaker.
     */
    long countBySpeakerId(UUID speakerId);
}





