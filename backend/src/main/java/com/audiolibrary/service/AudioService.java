package com.audiolibrary.service;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.AudioUpdateRequest;
import com.audiolibrary.dto.AudioUploadRequest;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.repository.AudioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudioService {

    private final AudioRepository audioRepository;

    /**
     * Create a new audio file in DRAFT status (legacy - metadata only)
     */
    @Transactional
    public AudioResponse createDraft(AudioUploadRequest request, UUID tenantId) {
        log.debug("Creating draft audio: title='{}' speaker='{}' tenant={}",
                request.getTitle(), request.getSpeaker(), tenantId);

        try {
            Audio audio = new Audio();
            audio.setTenantId(tenantId);
            audio.setTitle(request.getTitle());
            audio.setDescription(request.getDescription());
            audio.setSpeaker(request.getSpeaker());
            audio.setTopic(request.getTopic());
            audio.setLanguage(request.getLanguage() != null ? request.getLanguage() : "en");
            audio.setDurationSeconds(request.getDurationSeconds());
            audio.setMimeType(request.getMimeType());
            audio.setSizeBytes(request.getSizeBytes());
            audio.setStatus(Audio.Status.DRAFT);

            // Generate a placeholder S3 key and URL for now
            String s3Key = String.format("tenant/%s/audio/%s/%s", tenantId, UUID.randomUUID(), "audio.mp3");
            audio.setS3Key(s3Key);
            audio.setUrl("/api/v1/audio/" + UUID.randomUUID() + "/stream");

            Audio saved = audioRepository.save(audio);
            log.info("Created draft audio: id={} title='{}' tenant={} size={}bytes duration={}s",
                    saved.getId(), saved.getTitle(), tenantId, saved.getSizeBytes(), saved.getDurationSeconds());

            return AudioResponse.fromEntity(saved);
        } catch (Exception e) {
            log.error("Failed to create draft audio: title='{}' tenant={} error={}",
                    request.getTitle(), tenantId, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Create a new audio file with actual file upload
     */
    @Transactional
    public AudioResponse createDraftWithFile(
            String title,
            String description,
            String speaker,
            String category,
            String storageKey,
            String originalFilename,
            long sizeBytes,
            String mimeType,
            long durationSeconds,
            UUID tenantId) {
        
        Audio audio = new Audio();
        audio.setTenantId(tenantId);
        audio.setTitle(title);
        audio.setDescription(description);
        audio.setSpeaker(speaker);
        audio.setTopic(category);
        audio.setLanguage("en");
        audio.setDurationSeconds(durationSeconds);
        audio.setMimeType(mimeType);
        audio.setSizeBytes(sizeBytes);
        audio.setStatus(Audio.Status.DRAFT);
        audio.setStorageKey(storageKey);
        audio.setOriginalFilename(originalFilename);
        
        // Set the streaming URL
        Audio saved = audioRepository.save(audio);
        saved.setUrl("/api/v1/audio/" + saved.getId() + "/stream");
        saved = audioRepository.save(saved);
        
        log.info("Created draft audio with file: {} for tenant: {}", saved.getId(), tenantId);
        
        return AudioResponse.fromEntity(saved);
    }

    /**
     * Get audio entity by ID (for internal use)
     */
    public Audio getAudioEntity(UUID id) {
        return audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
    }

    /**
     * Get all audio files (optionally filtered by status)
     */
    public List<AudioResponse> getAllAudio(Audio.Status status) {
        List<Audio> audioList;
        if (status != null) {
            audioList = audioRepository.findByStatusAndDeletedAtIsNull(status);
        } else {
            audioList = audioRepository.findByDeletedAtIsNull();
        }
        return audioList.stream()
                .map(AudioResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get audio by ID
     */
    public AudioResponse getAudioById(UUID id) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        return AudioResponse.fromEntity(audio);
    }

    /**
     * Get all draft (staging) audio
     */
    public List<AudioResponse> getStagingAudio() {
        return getAllAudio(Audio.Status.DRAFT);
    }

    /**
     * Get all published audio
     */
    public List<AudioResponse> getPublishedAudio() {
        return getAllAudio(Audio.Status.PUBLISHED);
    }

    /**
     * Update audio metadata
     */
    @Transactional
    public AudioResponse updateAudio(UUID id, AudioUpdateRequest request) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        
        if (request.getTitle() != null) {
            audio.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            audio.setDescription(request.getDescription());
        }
        if (request.getSpeaker() != null) {
            audio.setSpeaker(request.getSpeaker());
        }
        if (request.getTopic() != null) {
            audio.setTopic(request.getTopic());
        }
        if (request.getLanguage() != null) {
            audio.setLanguage(request.getLanguage());
        }
        
        Audio saved = audioRepository.save(audio);
        log.info("Updated audio: {}", saved.getId());
        
        return AudioResponse.fromEntity(saved);
    }

    /**
     * Publish audio (move from DRAFT to PUBLISHED)
     */
    @Transactional
    public AudioResponse publishAudio(UUID id) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        
        if (audio.getStatus() == Audio.Status.PUBLISHED) {
            throw new RuntimeException("Audio is already published");
        }
        
        audio.setStatus(Audio.Status.PUBLISHED);
        audio.setPublishedAt(LocalDateTime.now());
        
        Audio saved = audioRepository.save(audio);
        log.info("Published audio: {}", saved.getId());
        
        return AudioResponse.fromEntity(saved);
    }

    /**
     * Unpublish audio (move back to DRAFT)
     */
    @Transactional
    public AudioResponse unpublishAudio(UUID id) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        
        audio.setStatus(Audio.Status.DRAFT);
        audio.setPublishedAt(null);
        
        Audio saved = audioRepository.save(audio);
        log.info("Unpublished audio: {}", saved.getId());
        
        return AudioResponse.fromEntity(saved);
    }

    /**
     * Archive audio
     */
    @Transactional
    public AudioResponse archiveAudio(UUID id) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        
        audio.setStatus(Audio.Status.ARCHIVED);
        
        Audio saved = audioRepository.save(audio);
        log.info("Archived audio: {}", saved.getId());
        
        return AudioResponse.fromEntity(saved);
    }

    /**
     * Soft delete audio
     */
    @Transactional
    public void deleteAudio(UUID id) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        
        audio.softDelete();
        audioRepository.save(audio);
        log.info("Soft deleted audio: {}", id);
    }

    /**
     * Get statistics for dashboard
     */
    public AudioStats getStats() {
        long draft = audioRepository.countByStatusAndDeletedAtIsNull(Audio.Status.DRAFT);
        long published = audioRepository.countByStatusAndDeletedAtIsNull(Audio.Status.PUBLISHED);
        long archived = audioRepository.countByStatusAndDeletedAtIsNull(Audio.Status.ARCHIVED);
        long total = audioRepository.countByDeletedAtIsNull();
        
        return AudioStats.builder()
                .draftCount(draft)
                .publishedCount(published)
                .archivedCount(archived)
                .totalCount(total)
                .build();
    }

    @lombok.Builder
    @lombok.Data
    public static class AudioStats {
        private long draftCount;
        private long publishedCount;
        private long archivedCount;
        private long totalCount;
    }
}

