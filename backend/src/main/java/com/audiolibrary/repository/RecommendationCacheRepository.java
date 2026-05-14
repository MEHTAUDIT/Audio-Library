package com.audiolibrary.repository;

import com.audiolibrary.entity.RecommendationCache;
import com.audiolibrary.entity.RecommendationCacheId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecommendationCacheRepository extends JpaRepository<RecommendationCache, RecommendationCacheId> {

    /**
     * Find top recommendations for a user.
     */
    @Query("SELECT r FROM RecommendationCache r JOIN FETCH r.audio " +
           "WHERE r.user.id = :userId ORDER BY r.score DESC")
    List<RecommendationCache> findTopRecommendationsForUser(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Delete all recommendations for a user (before regenerating).
     */
    void deleteAllByUserId(UUID userId);

    /**
     * Delete stale recommendations.
     */
    @Modifying
    @Query("DELETE FROM RecommendationCache r WHERE r.generatedAt < :before")
    void deleteStaleRecommendations(@Param("before") LocalDateTime before);

    /**
     * Check if user has fresh recommendations.
     */
    @Query("SELECT COUNT(r) > 0 FROM RecommendationCache r " +
           "WHERE r.user.id = :userId AND r.generatedAt > :since")
    boolean hasFreshRecommendations(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    /**
     * Count recommendations for user.
     */
    long countByUserId(UUID userId);
}





