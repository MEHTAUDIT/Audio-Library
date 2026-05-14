package com.audiolibrary.repository;

import com.audiolibrary.entity.UserFavoriteSpeakerJoin;
import com.audiolibrary.entity.UserFavoriteSpeakerJoinId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserFavoriteSpeakerJoinRepository extends JpaRepository<UserFavoriteSpeakerJoin, UserFavoriteSpeakerJoinId> {

    /**
     * Find all favorite speakers for a user.
     */
    @Query("SELECT f FROM UserFavoriteSpeakerJoin f JOIN FETCH f.speaker WHERE f.user.id = :userId ORDER BY f.createdAt DESC")
    List<UserFavoriteSpeakerJoin> findAllByUserId(@Param("userId") UUID userId);

    /**
     * Check if user has favorited a speaker.
     */
    boolean existsByUserIdAndSpeakerId(UUID userId, UUID speakerId);

    /**
     * Delete by user and speaker.
     */
    void deleteByUserIdAndSpeakerId(UUID userId, UUID speakerId);

    /**
     * Find all users who want notifications for a speaker.
     */
    @Query("SELECT f FROM UserFavoriteSpeakerJoin f WHERE f.speaker.id = :speakerId AND f.notifyOnNewAudio = true")
    List<UserFavoriteSpeakerJoin> findAllSubscribedToSpeaker(@Param("speakerId") UUID speakerId);

    /**
     * Count followers for a speaker.
     */
    long countBySpeakerId(UUID speakerId);
}





