package com.audiolibrary.service;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.entity.*;
import com.audiolibrary.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserLibraryService {

    private final UserRepository userRepository;
    private final AudioRepository audioRepository;
    private final SpeakerRepository speakerRepository;
    private final UserFavoriteAudioJoinRepository favoriteAudioRepository;
    private final UserFavoriteSpeakerJoinRepository favoriteSpeakerRepository;
    private final UserPlaybackQueueRepository queueRepository;
    private final ListeningHistoryRepository historyRepository;
    private final UserPreferencesRepository preferencesRepository;

    // ============ FAVORITE AUDIO ============

    @Transactional
    public void favoriteAudio(UUID userId, UUID audioId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new RuntimeException("Audio not found"));

        UserFavoriteAudioJoinId id = new UserFavoriteAudioJoinId();
        id.setUserId(userId);
        id.setAudioId(audioId);

        if (!favoriteAudioRepository.existsById(id)) {
            UserFavoriteAudioJoin favorite = new UserFavoriteAudioJoin();
            favorite.setId(id);
            favorite.setUser(user);
            favorite.setAudio(audio);
            favoriteAudioRepository.save(favorite);
            log.info("User {} favorited audio {}", userId, audioId);
        }
    }

    @Transactional
    public void unfavoriteAudio(UUID userId, UUID audioId) {
        UserFavoriteAudioJoinId id = new UserFavoriteAudioJoinId();
        id.setUserId(userId);
        id.setAudioId(audioId);
        favoriteAudioRepository.deleteById(id);
        log.info("User {} unfavorited audio {}", userId, audioId);
    }

    public boolean isAudioFavorited(UUID userId, UUID audioId) {
        UserFavoriteAudioJoinId id = new UserFavoriteAudioJoinId();
        id.setUserId(userId);
        id.setAudioId(audioId);
        return favoriteAudioRepository.existsById(id);
    }

    public List<AudioResponse> getFavoriteAudios(UUID userId) {
        return favoriteAudioRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(fav -> AudioResponse.fromEntity(fav.getAudio()))
                .collect(Collectors.toList());
    }

    // ============ FAVORITE SPEAKER ============

    @Transactional
    public void favoriteSpeaker(UUID userId, UUID speakerId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Speaker speaker = speakerRepository.findById(speakerId)
                .orElseThrow(() -> new RuntimeException("Speaker not found"));

        UserFavoriteSpeakerJoinId id = new UserFavoriteSpeakerJoinId();
        id.setUserId(userId);
        id.setSpeakerId(speakerId);

        if (!favoriteSpeakerRepository.existsById(id)) {
            UserFavoriteSpeakerJoin favorite = new UserFavoriteSpeakerJoin();
            favorite.setId(id);
            favorite.setUser(user);
            favorite.setSpeaker(speaker);
            favoriteSpeakerRepository.save(favorite);
            log.info("User {} favorited speaker {}", userId, speakerId);
        }
    }

    @Transactional
    public void unfavoriteSpeaker(UUID userId, UUID speakerId) {
        UserFavoriteSpeakerJoinId id = new UserFavoriteSpeakerJoinId();
        id.setUserId(userId);
        id.setSpeakerId(speakerId);
        favoriteSpeakerRepository.deleteById(id);
        log.info("User {} unfavorited speaker {}", userId, speakerId);
    }

    // ============ PLAYBACK QUEUE (Listen-to List) ============

    @Transactional
    public void addToQueue(UUID userId, UUID audioId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new RuntimeException("Audio not found"));

        // Get max position
        int maxPosition = queueRepository.findMaxPositionByUserId(userId).orElse(0);

        UserPlaybackQueue item = new UserPlaybackQueue();
        item.setUser(user);
        item.setAudio(audio);
        item.setPosition(maxPosition + 1);
        item.setSource(UserPlaybackQueue.Source.MANUAL);
        queueRepository.save(item);
        log.info("Added audio {} to user {} queue at position {}", audioId, userId, maxPosition + 1);
    }

    @Transactional
    public void removeFromQueue(UUID userId, UUID audioId) {
        queueRepository.deleteByUserIdAndAudioId(userId, audioId);
        log.info("Removed audio {} from user {} queue", audioId, userId);
    }

    public List<AudioResponse> getQueue(UUID userId) {
        return queueRepository.findByUserIdOrderByPosition(userId).stream()
                .map(item -> AudioResponse.fromEntity(item.getAudio()))
                .collect(Collectors.toList());
    }

    public boolean isInQueue(UUID userId, UUID audioId) {
        return queueRepository.existsByUserIdAndAudioId(userId, audioId);
    }

    // ============ LISTENING HISTORY & PLAYBACK POSITION ============

    @Transactional
    public void updatePlaybackPosition(UUID userId, UUID audioId, long positionSeconds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new RuntimeException("Audio not found"));

        // Update user's last played
        user.setLastPlayedAudioId(audioId);
        user.setLastPlayedPositionSeconds(positionSeconds);
        user.setLastPlayedAt(LocalDateTime.now());
        userRepository.save(user);

        // Find or create history entry
        Optional<ListeningHistory> existingHistory = historyRepository
                .findTopByUserIdAndAudioIdOrderByStartedAtDesc(userId, audioId);

        ListeningHistory history;
        if (existingHistory.isPresent() && existingHistory.get().getEndedAt() == null) {
            // Update existing active session
            history = existingHistory.get();
        } else {
            // Create new session
            history = new ListeningHistory();
            history.setUser(user);
            history.setAudio(audio);
            history.setTenantId(user.getTenantId());
        }
        
        history.setProgressSeconds(positionSeconds);
        historyRepository.save(history);
    }

    public Long getPlaybackPosition(UUID userId, UUID audioId) {
        return historyRepository.findTopByUserIdAndAudioIdOrderByStartedAtDesc(userId, audioId)
                .map(ListeningHistory::getProgressSeconds)
                .orElse(0L);
    }

    @Transactional
    public void endPlaybackSession(UUID userId, UUID audioId, long secondsListened) {
        historyRepository.findTopByUserIdAndAudioIdOrderByStartedAtDesc(userId, audioId)
                .ifPresent(history -> {
                    history.setEndedAt(LocalDateTime.now());
                    history.setSecondsListened(secondsListened);
                    historyRepository.save(history);
                });
    }

    public List<AudioResponse> getHistory(UUID userId, int limit) {
        return historyRepository.findByUserIdOrderByStartedAtDesc(userId).stream()
                .limit(limit)
                .map(h -> AudioResponse.fromEntity(h.getAudio()))
                .distinct()
                .collect(Collectors.toList());
    }

    // ============ USER PREFERENCES ============

    public UserPreferences getOrCreatePreferences(UUID userId) {
        return preferencesRepository.findById(userId)
                .orElseGet(() -> {
                    UserPreferences prefs = new UserPreferences();
                    prefs.setUserId(userId);
                    return preferencesRepository.save(prefs);
                });
    }

    @Transactional
    public UserPreferences updatePlaybackSpeed(UUID userId, double speed) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        prefs.setPreferredPlaybackSpeed(java.math.BigDecimal.valueOf(speed));
        return preferencesRepository.save(prefs);
    }
}

