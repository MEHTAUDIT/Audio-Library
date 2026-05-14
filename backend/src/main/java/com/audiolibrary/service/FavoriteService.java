package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.Speaker;
import com.audiolibrary.entity.User;
import com.audiolibrary.entity.UserFavoriteAudioJoin;
import com.audiolibrary.entity.UserFavoriteAudioJoinId;
import com.audiolibrary.entity.UserFavoriteSpeakerJoin;
import com.audiolibrary.entity.UserFavoriteSpeakerJoinId;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.SpeakerRepository;
import com.audiolibrary.repository.UserFavoriteAudioJoinRepository;
import com.audiolibrary.repository.UserFavoriteSpeakerJoinRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class FavoriteService {

    private final UserFavoriteAudioJoinRepository favoriteAudioJoinRepository;
    private final UserFavoriteSpeakerJoinRepository favoriteSpeakerJoinRepository;
    private final UserRepository userRepository;
    private final AudioRepository audioRepository;
    private final SpeakerRepository speakerRepository;

    // =====================
    // AUDIO FAVORITES
    // =====================

    /**
     * Add audio to favorites.
     */
    public UserFavoriteAudioJoin favoriteAudio(UUID userId, UUID audioId) {
        if (favoriteAudioJoinRepository.existsByUserIdAndAudioId(userId, audioId)) {
            return favoriteAudioJoinRepository.findById(new UserFavoriteAudioJoinId(userId, audioId)).orElseThrow();
        }
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        UserFavoriteAudioJoin favorite = new UserFavoriteAudioJoin();
        favorite.setId(new UserFavoriteAudioJoinId(userId, audioId));
        favorite.setUser(user);
        favorite.setAudio(audio);
        
        return favoriteAudioJoinRepository.save(favorite);
    }

    /**
     * Remove audio from favorites.
     */
    public void unfavoriteAudio(UUID userId, UUID audioId) {
        favoriteAudioJoinRepository.deleteByUserIdAndAudioId(userId, audioId);
    }

    /**
     * Check if audio is favorited.
     */
    @Transactional(readOnly = true)
    public boolean isAudioFavorited(UUID userId, UUID audioId) {
        return favoriteAudioJoinRepository.existsByUserIdAndAudioId(userId, audioId);
    }

    /**
     * Get user's favorite audio.
     */
    @Transactional(readOnly = true)
    public List<Audio> getFavoriteAudio(UUID userId) {
        return favoriteAudioJoinRepository.findAllByUserId(userId).stream()
                .map(UserFavoriteAudioJoin::getAudio)
                .filter(a -> a.getDeletedAt() == null)
                .collect(Collectors.toList());
    }

    /**
     * Get favorite audio with pagination.
     */
    @Transactional(readOnly = true)
    public Page<UserFavoriteAudioJoin> getFavoriteAudio(UUID userId, Pageable pageable) {
        return favoriteAudioJoinRepository.findAllByUserId(userId, pageable);
    }

    /**
     * Get favorite count for an audio (popularity).
     */
    @Transactional(readOnly = true)
    public long getAudioFavoriteCount(UUID audioId) {
        return favoriteAudioJoinRepository.countByAudioId(audioId);
    }

    /**
     * Get user's total favorite count.
     */
    @Transactional(readOnly = true)
    public long getUserFavoriteAudioCount(UUID userId) {
        return favoriteAudioJoinRepository.countByUserId(userId);
    }

    // =====================
    // SPEAKER FAVORITES
    // =====================

    /**
     * Follow a speaker.
     */
    public UserFavoriteSpeakerJoin followSpeaker(UUID userId, UUID speakerId, boolean notifyOnNewAudio) {
        if (favoriteSpeakerJoinRepository.existsByUserIdAndSpeakerId(userId, speakerId)) {
            // Update notification preference if already following
            UserFavoriteSpeakerJoin existing = favoriteSpeakerJoinRepository
                    .findById(new UserFavoriteSpeakerJoinId(userId, speakerId)).orElseThrow();
            existing.setNotifyOnNewAudio(notifyOnNewAudio);
            return favoriteSpeakerJoinRepository.save(existing);
        }
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        
        UserFavoriteSpeakerJoin favorite = new UserFavoriteSpeakerJoin();
        favorite.setId(new UserFavoriteSpeakerJoinId(userId, speakerId));
        favorite.setUser(user);
        favorite.setSpeaker(speaker);
        favorite.setNotifyOnNewAudio(notifyOnNewAudio);
        
        return favoriteSpeakerJoinRepository.save(favorite);
    }

    /**
     * Unfollow a speaker.
     */
    public void unfollowSpeaker(UUID userId, UUID speakerId) {
        favoriteSpeakerJoinRepository.deleteByUserIdAndSpeakerId(userId, speakerId);
    }

    /**
     * Check if following a speaker.
     */
    @Transactional(readOnly = true)
    public boolean isFollowingSpeaker(UUID userId, UUID speakerId) {
        return favoriteSpeakerJoinRepository.existsByUserIdAndSpeakerId(userId, speakerId);
    }

    /**
     * Get user's followed speakers.
     */
    @Transactional(readOnly = true)
    public List<Speaker> getFollowedSpeakers(UUID userId) {
        return favoriteSpeakerJoinRepository.findAllByUserId(userId).stream()
                .map(UserFavoriteSpeakerJoin::getSpeaker)
                .filter(s -> s.getDeletedAt() == null)
                .collect(Collectors.toList());
    }

    /**
     * Update notification preference for a speaker.
     */
    public void updateSpeakerNotifications(UUID userId, UUID speakerId, boolean notifyOnNewAudio) {
        UserFavoriteSpeakerJoin favorite = favoriteSpeakerJoinRepository
                .findById(new UserFavoriteSpeakerJoinId(userId, speakerId))
                .orElseThrow(() -> new IllegalArgumentException("Not following speaker"));
        
        favorite.setNotifyOnNewAudio(notifyOnNewAudio);
        favoriteSpeakerJoinRepository.save(favorite);
    }

    /**
     * Get follower count for a speaker.
     */
    @Transactional(readOnly = true)
    public long getSpeakerFollowerCount(UUID speakerId) {
        return favoriteSpeakerJoinRepository.countBySpeakerId(speakerId);
    }

    /**
     * Get users who want notifications for a speaker.
     */
    @Transactional(readOnly = true)
    public List<User> getUsersSubscribedToSpeaker(UUID speakerId) {
        return favoriteSpeakerJoinRepository.findAllSubscribedToSpeaker(speakerId).stream()
                .map(UserFavoriteSpeakerJoin::getUser)
                .collect(Collectors.toList());
    }
}
