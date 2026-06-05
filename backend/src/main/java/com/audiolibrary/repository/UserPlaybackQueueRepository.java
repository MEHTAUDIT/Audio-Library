package com.audiolibrary.repository;

import com.audiolibrary.entity.UserPlaybackQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserPlaybackQueueRepository extends JpaRepository<UserPlaybackQueue, UUID> {

    /**
     * Find all queue items for a user, ordered by position.
     */
    @Query("""
           SELECT DISTINCT q
           FROM UserPlaybackQueue q
           JOIN FETCH q.audio a
           LEFT JOIN FETCH a.series
           LEFT JOIN FETCH a.audioSpeakers asp
           LEFT JOIN FETCH asp.speaker
           WHERE q.user.id = :userId
           ORDER BY q.position
           """)
    List<UserPlaybackQueue> findAllByUserIdOrderByPosition(@Param("userId") UUID userId);

    /**
     * Find queue items by user, ordered by position.
     */
    @Query("""
           SELECT DISTINCT q
           FROM UserPlaybackQueue q
           JOIN FETCH q.audio a
           LEFT JOIN FETCH a.series
           LEFT JOIN FETCH a.audioSpeakers asp
           LEFT JOIN FETCH asp.speaker
           WHERE q.user.id = :userId
           ORDER BY q.position
           """)
    List<UserPlaybackQueue> findByUserIdOrderByPosition(@Param("userId") UUID userId);

    /**
     * Delete by user and audio.
     */
    void deleteByUserIdAndAudioId(UUID userId, UUID audioId);

    /**
     * Find the next item in queue (position 1).
     */
    @Query("""
           SELECT DISTINCT q
           FROM UserPlaybackQueue q
           JOIN FETCH q.audio a
           LEFT JOIN FETCH a.series
           LEFT JOIN FETCH a.audioSpeakers asp
           LEFT JOIN FETCH asp.speaker
           WHERE q.user.id = :userId AND q.position = 1
           """)
    Optional<UserPlaybackQueue> findNextInQueue(@Param("userId") UUID userId);

    /**
     * Get max position in user's queue.
     */
    @Query("SELECT MAX(q.position) FROM UserPlaybackQueue q WHERE q.user.id = :userId")
    Optional<Integer> findMaxPositionByUserId(@Param("userId") UUID userId);

    /**
     * Count items in user's queue.
     */
    long countByUserId(UUID userId);

    /**
     * Check if audio is already in queue.
     */
    boolean existsByUserIdAndAudioId(UUID userId, UUID audioId);

    /**
     * Find by user and audio.
     */
    Optional<UserPlaybackQueue> findByUserIdAndAudioId(UUID userId, UUID audioId);

    /**
     * Clear entire queue for user.
     */
    void deleteAllByUserId(UUID userId);

    /**
     * Shift positions down (for insertion at specific position).
     */
    @Modifying
    @Query("UPDATE UserPlaybackQueue q SET q.position = q.position + 1 " +
           "WHERE q.user.id = :userId AND q.position >= :fromPosition")
    void shiftPositionsDown(@Param("userId") UUID userId, @Param("fromPosition") int fromPosition);

    /**
     * Shift positions up (after removal).
     */
    @Modifying
    @Query("UPDATE UserPlaybackQueue q SET q.position = q.position - 1 " +
           "WHERE q.user.id = :userId AND q.position > :fromPosition")
    void shiftPositionsUp(@Param("userId") UUID userId, @Param("fromPosition") int fromPosition);

    /**
     * Remove played item and shift queue.
     */
    @Modifying
    @Query("DELETE FROM UserPlaybackQueue q WHERE q.user.id = :userId AND q.position = 1")
    void removeFirstFromQueue(@Param("userId") UUID userId);
}



