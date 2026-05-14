package com.audiolibrary.repository;

import com.audiolibrary.entity.ListeningHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ListeningHistoryRepository extends JpaRepository<ListeningHistory, UUID> {

    /**
     * Find user's listening history ordered by most recent.
     */
    @Query("SELECT h FROM ListeningHistory h JOIN FETCH h.audio WHERE h.user.id = :userId ORDER BY h.startedAt DESC")
    Page<ListeningHistory> findByUserIdOrderByStartedAtDesc(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Find recent listening history for continue listening.
     */
    @Query("SELECT h FROM ListeningHistory h JOIN FETCH h.audio " +
           "WHERE h.user.id = :userId AND h.endedAt IS NULL " +
           "ORDER BY h.startedAt DESC")
    List<ListeningHistory> findInProgressByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Find most recent session for a specific audio.
     */
    @Query("SELECT h FROM ListeningHistory h WHERE h.user.id = :userId AND h.audio.id = :audioId " +
           "ORDER BY h.startedAt DESC")
    Optional<ListeningHistory> findMostRecentByUserAndAudio(@Param("userId") UUID userId, @Param("audioId") UUID audioId);

    /**
     * Find top listening history entry by user and audio.
     */
    Optional<ListeningHistory> findTopByUserIdAndAudioIdOrderByStartedAtDesc(UUID userId, UUID audioId);

    /**
     * Find all history for a user ordered by started at.
     */
    @Query("SELECT h FROM ListeningHistory h JOIN FETCH h.audio WHERE h.user.id = :userId ORDER BY h.startedAt DESC")
    List<ListeningHistory> findByUserIdOrderByStartedAtDesc(@Param("userId") UUID userId);

    /**
     * Get total listening time for a user.
     */
    @Query("SELECT COALESCE(SUM(h.secondsListened), 0) FROM ListeningHistory h WHERE h.user.id = :userId")
    long getTotalListeningTimeByUserId(@Param("userId") UUID userId);

    /**
     * Get listening time for a user in a date range.
     */
    @Query("SELECT COALESCE(SUM(h.secondsListened), 0) FROM ListeningHistory h " +
           "WHERE h.user.id = :userId AND h.startedAt BETWEEN :start AND :end")
    long getListeningTimeByUserIdAndDateRange(
            @Param("userId") UUID userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Find most listened audio IDs for a user (for recommendations).
     */
    @Query("SELECT h.audio.id, COUNT(h) as playCount FROM ListeningHistory h " +
           "WHERE h.user.id = :userId GROUP BY h.audio.id ORDER BY playCount DESC")
    List<Object[]> findMostPlayedByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Count plays for an audio.
     */
    long countByAudioId(UUID audioId);

    /**
     * Count unique listeners for an audio.
     */
    @Query("SELECT COUNT(DISTINCT h.user.id) FROM ListeningHistory h WHERE h.audio.id = :audioId")
    long countUniqueListenersByAudioId(@Param("audioId") UUID audioId);
}



