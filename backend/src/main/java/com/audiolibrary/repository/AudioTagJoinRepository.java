package com.audiolibrary.repository;

import com.audiolibrary.entity.AudioTagJoin;
import com.audiolibrary.entity.AudioTagJoinId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AudioTagJoinRepository extends JpaRepository<AudioTagJoin, AudioTagJoinId> {

    /**
     * Find all tags for an audio file.
     */
    @Query("SELECT at FROM AudioTagJoin at JOIN FETCH at.tag WHERE at.audio.id = :audioId")
    List<AudioTagJoin> findAllByAudioId(@Param("audioId") UUID audioId);

    /**
     * Find all audio files with a specific tag.
     */
    @Query("SELECT at FROM AudioTagJoin at JOIN FETCH at.audio WHERE at.tag.id = :tagId")
    List<AudioTagJoin> findAllByTagId(@Param("tagId") UUID tagId);

    /**
     * Delete all tags for an audio file.
     */
    void deleteAllByAudioId(UUID audioId);

    /**
     * Check if audio has a specific tag.
     */
    boolean existsByAudioIdAndTagId(UUID audioId, UUID tagId);
}





