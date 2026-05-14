package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.ListeningHistory;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.ListeningHistoryRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ListeningHistoryService {

    private final ListeningHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final AudioRepository audioRepository;

    /**
     * Start a listening session.
     */
    public ListeningHistory startListening(UUID userId, UUID audioId, UUID tenantId, UUID clientSessionId, String source) {
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        ListeningHistory history = new ListeningHistory();
        history.setUser(user);
        history.setAudio(audio);
        history.setTenantId(tenantId);
        history.setClientSessionId(clientSessionId);
        history.setSource(source);
        history.setSecondsListened(0L);
        history.setProgressSeconds(0L);
        
        return historyRepository.save(history);
    }

    /**
     * Update listening progress.
     */
    public ListeningHistory updateProgress(UUID historyId, long progressSeconds, long secondsListened) {
        ListeningHistory history = historyRepository.findById(historyId)
                .orElseThrow(() -> new IllegalArgumentException("History not found: " + historyId));
        
        history.setProgressSeconds(progressSeconds);
        history.setSecondsListened(secondsListened);
        
        return historyRepository.save(history);
    }

    /**
     * End a listening session.
     */
    public ListeningHistory endListening(UUID historyId, long finalProgressSeconds, long totalSecondsListened) {
        ListeningHistory history = historyRepository.findById(historyId)
                .orElseThrow(() -> new IllegalArgumentException("History not found: " + historyId));
        
        history.setEndedAt(LocalDateTime.now());
        history.setProgressSeconds(finalProgressSeconds);
        history.setSecondsListened(totalSecondsListened);
        
        return historyRepository.save(history);
    }

    /**
     * Get user's listening history.
     */
    @Transactional(readOnly = true)
    public Page<ListeningHistory> getUserHistory(UUID userId, Pageable pageable) {
        return historyRepository.findByUserIdOrderByStartedAtDesc(userId, pageable);
    }

    /**
     * Get in-progress listening sessions (for "Continue Listening").
     */
    @Transactional(readOnly = true)
    public List<ListeningHistory> getInProgressListening(UUID userId, int limit) {
        return historyRepository.findInProgressByUserId(userId, PageRequest.of(0, limit));
    }

    /**
     * Get most recent session for a specific audio.
     */
    @Transactional(readOnly = true)
    public Optional<ListeningHistory> getRecentSessionForAudio(UUID userId, UUID audioId) {
        return historyRepository.findMostRecentByUserAndAudio(userId, audioId);
    }

    /**
     * Get resume position for an audio file.
     */
    @Transactional(readOnly = true)
    public long getResumePosition(UUID userId, UUID audioId) {
        return historyRepository.findMostRecentByUserAndAudio(userId, audioId)
                .map(h -> h.getProgressSeconds() != null ? h.getProgressSeconds() : 0L)
                .orElse(0L);
    }

    /**
     * Get total listening time for user.
     */
    @Transactional(readOnly = true)
    public long getTotalListeningTime(UUID userId) {
        return historyRepository.getTotalListeningTimeByUserId(userId);
    }

    /**
     * Get listening time for a date range.
     */
    @Transactional(readOnly = true)
    public long getListeningTimeForPeriod(UUID userId, LocalDateTime start, LocalDateTime end) {
        return historyRepository.getListeningTimeByUserIdAndDateRange(userId, start, end);
    }

    /**
     * Get most played audio IDs for recommendations.
     */
    @Transactional(readOnly = true)
    public List<Object[]> getMostPlayedAudioIds(UUID userId, int limit) {
        return historyRepository.findMostPlayedByUserId(userId, PageRequest.of(0, limit));
    }

    /**
     * Get play count for an audio.
     */
    @Transactional(readOnly = true)
    public long getPlayCount(UUID audioId) {
        return historyRepository.countByAudioId(audioId);
    }

    /**
     * Get unique listener count for an audio.
     */
    @Transactional(readOnly = true)
    public long getUniqueListenerCount(UUID audioId) {
        return historyRepository.countUniqueListenersByAudioId(audioId);
    }

    /**
     * Record a simple play event (when full session tracking isn't needed).
     */
    public ListeningHistory recordPlay(UUID userId, UUID audioId, UUID tenantId, String source) {
        ListeningHistory history = startListening(userId, audioId, tenantId, null, source);
        history.setEndedAt(LocalDateTime.now());
        return historyRepository.save(history);
    }
}





