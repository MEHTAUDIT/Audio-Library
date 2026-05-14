package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.AudioSpeakerJoin;
import com.audiolibrary.entity.AudioSpeakerJoinId;
import com.audiolibrary.entity.Speaker;
import com.audiolibrary.entity.UserFavoriteSpeakerJoin;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.AudioSpeakerJoinRepository;
import com.audiolibrary.repository.SpeakerRepository;
import com.audiolibrary.repository.UserFavoriteSpeakerJoinRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SpeakerService {

    private final SpeakerRepository speakerRepository;
    private final AudioSpeakerJoinRepository audioSpeakerJoinRepository;
    private final AudioRepository audioRepository;
    private final UserFavoriteSpeakerJoinRepository favoriteSpeakerJoinRepository;

    /**
     * Create a new speaker.
     */
    public Speaker createSpeaker(UUID tenantId, String name, String bio, String avatarUrl, String websiteUrl) {
        Speaker speaker = new Speaker();
        speaker.setTenantId(tenantId);
        speaker.setName(name);
        speaker.setBio(bio);
        speaker.setAvatarUrl(avatarUrl);
        speaker.setWebsiteUrl(websiteUrl);
        
        return speakerRepository.save(speaker);
    }

    /**
     * Get all active speakers for a tenant.
     */
    @Transactional(readOnly = true)
    public List<Speaker> getAllSpeakers(UUID tenantId) {
        return speakerRepository.findAllActiveByTenantId(tenantId);
    }

    /**
     * Get speakers with pagination.
     */
    @Transactional(readOnly = true)
    public Page<Speaker> getSpeakers(UUID tenantId, Pageable pageable) {
        return speakerRepository.findAllActiveByTenantId(tenantId, pageable);
    }

    /**
     * Find speaker by ID.
     */
    @Transactional(readOnly = true)
    public Optional<Speaker> findById(UUID speakerId) {
        return speakerRepository.findActiveById(speakerId);
    }

    /**
     * Search speakers by name.
     */
    @Transactional(readOnly = true)
    public Page<Speaker> searchSpeakers(UUID tenantId, String query, Pageable pageable) {
        return speakerRepository.searchByName(tenantId, query, pageable);
    }

    /**
     * Update speaker details.
     */
    public Speaker updateSpeaker(UUID speakerId, String name, String bio, String avatarUrl, String websiteUrl) {
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        
        if (name != null) {
            speaker.setName(name);
        }
        if (bio != null) {
            speaker.setBio(bio);
        }
        if (avatarUrl != null) {
            speaker.setAvatarUrl(avatarUrl);
        }
        if (websiteUrl != null) {
            speaker.setWebsiteUrl(websiteUrl);
        }
        
        return speakerRepository.save(speaker);
    }

    /**
     * Soft delete a speaker.
     */
    public void deleteSpeaker(UUID speakerId) {
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        speaker.setDeletedAt(LocalDateTime.now());
        speakerRepository.save(speaker);
    }

    /**
     * Add speaker to audio.
     */
    public void addSpeakerToAudio(UUID audioId, UUID speakerId, AudioSpeakerJoin.Role role, Integer displayOrder) {
        if (audioSpeakerJoinRepository.existsByAudioIdAndSpeakerId(audioId, speakerId)) {
            return; // Already linked
        }
        
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        
        AudioSpeakerJoin audioSpeakerJoin = new AudioSpeakerJoin();
        audioSpeakerJoin.setId(new AudioSpeakerJoinId(audioId, speakerId));
        audioSpeakerJoin.setAudio(audio);
        audioSpeakerJoin.setSpeaker(speaker);
        audioSpeakerJoin.setRole(role != null ? role : AudioSpeakerJoin.Role.SPEAKER);
        audioSpeakerJoin.setDisplayOrder(displayOrder);
        
        audioSpeakerJoinRepository.save(audioSpeakerJoin);
    }

    /**
     * Remove speaker from audio.
     */
    public void removeSpeakerFromAudio(UUID audioId, UUID speakerId) {
        AudioSpeakerJoinId id = new AudioSpeakerJoinId(audioId, speakerId);
        audioSpeakerJoinRepository.deleteById(id);
    }

    /**
     * Get speakers for an audio.
     */
    @Transactional(readOnly = true)
    public List<Speaker> getSpeakersForAudio(UUID audioId) {
        return audioSpeakerJoinRepository.findAllByAudioId(audioId).stream()
                .map(AudioSpeakerJoin::getSpeaker)
                .collect(Collectors.toList());
    }

    /**
     * Get audio files for a speaker.
     */
    @Transactional(readOnly = true)
    public List<Audio> getAudioForSpeaker(UUID speakerId) {
        return audioSpeakerJoinRepository.findAllBySpeakerId(speakerId).stream()
                .map(AudioSpeakerJoin::getAudio)
                .filter(a -> a.getDeletedAt() == null) // Only active audio
                .collect(Collectors.toList());
    }

    /**
     * Get follower count for speaker.
     */
    @Transactional(readOnly = true)
    public long getFollowerCount(UUID speakerId) {
        return favoriteSpeakerJoinRepository.countBySpeakerId(speakerId);
    }

    /**
     * Get audio count for speaker.
     */
    @Transactional(readOnly = true)
    public long getAudioCount(UUID speakerId) {
        return audioSpeakerJoinRepository.countBySpeakerId(speakerId);
    }

    /**
     * Get users subscribed to speaker notifications.
     */
    @Transactional(readOnly = true)
    public List<UserFavoriteSpeakerJoin> getSubscribedUsers(UUID speakerId) {
        return favoriteSpeakerJoinRepository.findAllSubscribedToSpeaker(speakerId);
    }
}
