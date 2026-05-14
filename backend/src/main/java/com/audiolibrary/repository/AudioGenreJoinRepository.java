package com.audiolibrary.repository;

import com.audiolibrary.entity.AudioGenreJoin;
import com.audiolibrary.entity.AudioGenreJoinId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AudioGenreJoinRepository extends JpaRepository<AudioGenreJoin, AudioGenreJoinId> {

    /**
     * Find all genres for an audio.
     */
    @Query("SELECT ag FROM AudioGenreJoin ag JOIN FETCH ag.genre WHERE ag.audio.id = :audioId")
    List<AudioGenreJoin> findAllByAudioId(@Param("audioId") UUID audioId);

    /**
     * Find all audio for a genre.
     */
    @Query("SELECT ag FROM AudioGenreJoin ag JOIN FETCH ag.audio WHERE ag.genre.id = :genreId")
    List<AudioGenreJoin> findAllByGenreId(@Param("genreId") UUID genreId);

    /**
     * Delete all genres for an audio.
     */
    void deleteAllByAudioId(UUID audioId);

    /**
     * Check if audio has a specific genre.
     */
    boolean existsByAudioIdAndGenreId(UUID audioId, UUID genreId);

    /**
     * Count audio files for a genre.
     */
    long countByGenreId(UUID genreId);
}





