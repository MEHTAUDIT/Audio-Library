package com.audiolibrary.repository;

import com.audiolibrary.entity.UserFavoriteAudioJoin;
import com.audiolibrary.entity.UserFavoriteAudioJoinId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserFavoriteAudioJoinRepository extends JpaRepository<UserFavoriteAudioJoin, UserFavoriteAudioJoinId> {

    /**
     * Find all favorite audio for a user.
     */
    @Query("""
           SELECT DISTINCT f
           FROM UserFavoriteAudioJoin f
           JOIN FETCH f.audio a
           LEFT JOIN FETCH a.series
           LEFT JOIN FETCH a.audioSpeakers asp
           LEFT JOIN FETCH asp.speaker
           WHERE f.user.id = :userId
           ORDER BY f.createdAt DESC
           """)
    List<UserFavoriteAudioJoin> findAllByUserId(@Param("userId") UUID userId);

    /**
     * Find favorite audio for a user, ordered by createdAt descending.
     */
    @Query("""
           SELECT DISTINCT f
           FROM UserFavoriteAudioJoin f
           JOIN FETCH f.audio a
           LEFT JOIN FETCH a.series
           LEFT JOIN FETCH a.audioSpeakers asp
           LEFT JOIN FETCH asp.speaker
           WHERE f.user.id = :userId
           ORDER BY f.createdAt DESC
           """)
    List<UserFavoriteAudioJoin> findByUserIdOrderByCreatedAtDesc(@Param("userId") UUID userId);

    /**
     * Find all favorite audio for a user with pagination.
     */
    @Query(value = """
           SELECT DISTINCT f
           FROM UserFavoriteAudioJoin f
           JOIN FETCH f.audio a
           LEFT JOIN FETCH a.series
           LEFT JOIN FETCH a.audioSpeakers asp
           LEFT JOIN FETCH asp.speaker
           WHERE f.user.id = :userId
           """,
           countQuery = "SELECT COUNT(f) FROM UserFavoriteAudioJoin f WHERE f.user.id = :userId")
    Page<UserFavoriteAudioJoin> findAllByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Check if user has favorited an audio.
     */
    boolean existsByUserIdAndAudioId(UUID userId, UUID audioId);

    /**
     * Delete by user and audio.
     */
    void deleteByUserIdAndAudioId(UUID userId, UUID audioId);

    /**
     * Count favorites for an audio (popularity metric).
     */
    long countByAudioId(UUID audioId);

    /**
     * Count user's favorites.
     */
    long countByUserId(UUID userId);
}



