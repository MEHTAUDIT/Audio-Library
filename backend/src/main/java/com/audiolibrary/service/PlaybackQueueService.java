package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.User;
import com.audiolibrary.entity.UserPlaybackQueue;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.UserPlaybackQueueRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class PlaybackQueueService {

    private final UserPlaybackQueueRepository queueRepository;
    private final UserRepository userRepository;
    private final AudioRepository audioRepository;

    /**
     * Get user's playback queue.
     */
    @Transactional(readOnly = true)
    public List<UserPlaybackQueue> getQueue(UUID userId) {
        return queueRepository.findAllByUserIdOrderByPosition(userId);
    }

    /**
     * Get next item in queue.
     */
    @Transactional(readOnly = true)
    public Optional<UserPlaybackQueue> getNextInQueue(UUID userId) {
        return queueRepository.findNextInQueue(userId);
    }

    /**
     * Add audio to end of queue.
     */
    public UserPlaybackQueue addToQueue(UUID userId, UUID audioId, UserPlaybackQueue.Source source) {
        // Check if already in queue
        if (queueRepository.existsByUserIdAndAudioId(userId, audioId)) {
            return queueRepository.findByUserIdAndAudioId(userId, audioId).orElseThrow();
        }
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        int nextPosition = queueRepository.findMaxPositionByUserId(userId).orElse(0) + 1;
        
        UserPlaybackQueue queueItem = new UserPlaybackQueue();
        queueItem.setUser(user);
        queueItem.setAudio(audio);
        queueItem.setPosition(nextPosition);
        queueItem.setSource(source != null ? source : UserPlaybackQueue.Source.MANUAL);
        
        return queueRepository.save(queueItem);
    }

    /**
     * Add audio at specific position (play next).
     */
    public UserPlaybackQueue addToQueueAtPosition(UUID userId, UUID audioId, int position, UserPlaybackQueue.Source source) {
        // Remove if already in queue
        queueRepository.findByUserIdAndAudioId(userId, audioId)
                .ifPresent(existing -> {
                    queueRepository.delete(existing);
                    queueRepository.shiftPositionsUp(userId, existing.getPosition());
                });
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        // Shift existing items down
        queueRepository.shiftPositionsDown(userId, position);
        
        UserPlaybackQueue queueItem = new UserPlaybackQueue();
        queueItem.setUser(user);
        queueItem.setAudio(audio);
        queueItem.setPosition(position);
        queueItem.setSource(source != null ? source : UserPlaybackQueue.Source.MANUAL);
        
        return queueRepository.save(queueItem);
    }

    /**
     * Add audio to "play next" (position 1).
     */
    public UserPlaybackQueue playNext(UUID userId, UUID audioId) {
        return addToQueueAtPosition(userId, audioId, 1, UserPlaybackQueue.Source.MANUAL);
    }

    /**
     * Remove audio from queue.
     */
    public void removeFromQueue(UUID userId, UUID audioId) {
        queueRepository.findByUserIdAndAudioId(userId, audioId)
                .ifPresent(item -> {
                    int position = item.getPosition();
                    queueRepository.delete(item);
                    queueRepository.shiftPositionsUp(userId, position);
                });
    }

    /**
     * Pop and return the next item (remove from queue).
     */
    public Optional<Audio> popNext(UUID userId) {
        Optional<UserPlaybackQueue> next = queueRepository.findNextInQueue(userId);
        if (next.isPresent()) {
            Audio audio = next.get().getAudio();
            queueRepository.removeFirstFromQueue(userId);
            // Shift all remaining positions up
            queueRepository.shiftPositionsUp(userId, 0);
            return Optional.of(audio);
        }
        return Optional.empty();
    }

    /**
     * Clear entire queue.
     */
    public void clearQueue(UUID userId) {
        queueRepository.deleteAllByUserId(userId);
    }

    /**
     * Get queue size.
     */
    @Transactional(readOnly = true)
    public long getQueueSize(UUID userId) {
        return queueRepository.countByUserId(userId);
    }

    /**
     * Check if audio is in queue.
     */
    @Transactional(readOnly = true)
    public boolean isInQueue(UUID userId, UUID audioId) {
        return queueRepository.existsByUserIdAndAudioId(userId, audioId);
    }

    /**
     * Reorder queue item.
     */
    public void reorderQueueItem(UUID userId, UUID audioId, int newPosition) {
        UserPlaybackQueue item = queueRepository.findByUserIdAndAudioId(userId, audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not in queue"));
        
        int currentPosition = item.getPosition();
        if (currentPosition == newPosition) {
            return;
        }
        
        if (newPosition < currentPosition) {
            queueRepository.shiftPositionsDown(userId, newPosition);
        } else {
            queueRepository.shiftPositionsUp(userId, currentPosition);
        }
        
        item.setPosition(newPosition);
        queueRepository.save(item);
    }

    /**
     * Update user's "last played" info for resume functionality.
     */
    public void updateLastPlayed(UUID userId, UUID audioId, long positionSeconds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        
        user.setLastPlayedAudioId(audioId);
        user.setLastPlayedPositionSeconds(positionSeconds);
        user.setLastPlayedAt(LocalDateTime.now());
        
        userRepository.save(user);
    }

    /**
     * Get user's last played info.
     */
    @Transactional(readOnly = true)
    public Optional<Audio> getLastPlayed(UUID userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getLastPlayedAudioId() != null)
                .flatMap(u -> audioRepository.findById(u.getLastPlayedAudioId()));
    }

    /**
     * Get last played position.
     */
    @Transactional(readOnly = true)
    public long getLastPlayedPosition(UUID userId) {
        return userRepository.findById(userId)
                .map(u -> u.getLastPlayedPositionSeconds() != null ? u.getLastPlayedPositionSeconds() : 0L)
                .orElse(0L);
    }
}



