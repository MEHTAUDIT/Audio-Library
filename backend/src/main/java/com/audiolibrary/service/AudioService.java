package com.audiolibrary.service;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.AudioUpdateRequest;
import com.audiolibrary.dto.AudioUploadRequest;
import com.audiolibrary.entity.*;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.AudioSpeakerJoinRepository;
import com.audiolibrary.repository.GenreRepository;
import com.audiolibrary.repository.SpeakerRepository;
import com.audiolibrary.repository.TagRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AudioService {

    private final AudioRepository audioRepository;
    private final GenreRepository genreRepository;
    private final TagRepository tagRepository;
    private final SpeakerRepository speakerRepository;
    private final AudioSpeakerJoinRepository audioSpeakerJoinRepository;
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

            Speaker resolvedSpeaker = null;
            if (request.getSpeakerId() != null) {
                resolvedSpeaker = resolveSpeaker(tenantId, request.getSpeakerId());
                audio.setSpeaker(resolvedSpeaker.getName());
            } else {
                audio.setSpeaker(request.getSpeaker());
            }

            // Generate a placeholder S3 key and URL for now
            String s3Key = String.format("tenant/%s/audio/%s/%s", tenantId, UUID.randomUUID(), "audio.mp3");
            audio.setS3Key(s3Key);
            audio.setUrl("/api/v1/audio/" + UUID.randomUUID() + "/stream");

            Audio saved = audioRepository.save(audio);
            if (resolvedSpeaker != null) {
                replaceSpeakers(saved, List.of(resolvedSpeaker));
                saved = audioRepository.findByIdWithSpeakers(saved.getId()).orElse(saved);
            }
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
     * Create a new audio file with actual file upload.
     * Checks for duplicates using file hash before saving.
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
            UUID tenantId,
            String fileHash) {
        return createDraftWithFile(
            title,
            description,
            speaker,
            null,
            category,
            storageKey,
            originalFilename,
            sizeBytes,
            mimeType,
            durationSeconds,
            tenantId,
            fileHash
        );
        }

    @Transactional
    public AudioResponse createDraftWithFile(
            String title,
            String description,
            String speaker,
            UUID speakerId,
            String category,
            String storageKey,
            String originalFilename,
            long sizeBytes,
            String mimeType,
            long durationSeconds,
            UUID tenantId,
            String fileHash) {

        if (fileHash != null) {
            Optional<Audio> existing = audioRepository.findByFileHashAndDeletedAtIsNull(fileHash);
            if (existing.isPresent()) {
                Audio dup = existing.get();
                log.warn("Duplicate file detected: hash={}, existing audioId={}, title='{}', new title='{}'",
                        fileHash, dup.getId(), dup.getTitle(), title);
                throw new DuplicateFileException(
                        "Duplicate file detected. This file already exists as: " + dup.getTitle(),
                        dup.getId(),
                        dup.getTitle());
            }
        }

        Audio audio = new Audio();
        audio.setTenantId(tenantId);
        audio.setTitle(title);
        audio.setDescription(description);
        Speaker resolvedSpeaker = null;
        if (speakerId != null) {
            resolvedSpeaker = resolveSpeaker(tenantId, speakerId);
            audio.setSpeaker(resolvedSpeaker.getName());
        } else {
            audio.setSpeaker(speaker);
        }
        audio.setTopic(category);
        audio.setLanguage("en");
        audio.setDurationSeconds(durationSeconds);
        audio.setMimeType(mimeType);
        audio.setSizeBytes(sizeBytes);
        audio.setStatus(Audio.Status.DRAFT);
        audio.setStorageKey(storageKey);
        audio.setOriginalFilename(originalFilename);
        audio.setFileHash(fileHash);

        if (mimeType != null && mimeType.startsWith("video/")) {
            audio.setMediaType(Audio.MediaType.VIDEO);
        } else {
            audio.setMediaType(Audio.MediaType.AUDIO);
        }

        // Set the streaming URL
        Audio saved = audioRepository.save(audio);
        saved.setUrl("/api/v1/audio/" + saved.getId() + "/stream");
        saved = audioRepository.save(saved);

        if (resolvedSpeaker != null) {
            replaceSpeakers(saved, List.of(resolvedSpeaker));
            saved = audioRepository.findByIdWithSpeakers(saved.getId()).orElse(saved);
        }

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
    @Transactional(readOnly = true)
    public List<AudioResponse> getAllAudio(Audio.Status status) {
        List<Audio> audioList;
        if (status != null) {
            audioList = audioRepository.findAllWithSpeakersByStatusAndDeletedAtIsNull(status);
        } else {
            audioList = audioRepository.findAllWithSpeakersByDeletedAtIsNull();
        }
        return audioList.stream()
                .map(AudioResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /* optionally:  get filtered list of audio from searchbar */
    @Transactional(readOnly = true)
    public List<AudioResponse> getFilteredAudioList(
            String speakerName,
            String tag,
            String genre,
            String audioSubstring
    ) {

        Specification<Audio> spec = (root, query, cb) -> {

            List<Predicate> predicates = new ArrayList<>(); // predicates -> conditions

            // Only published + not deleted
            predicates.add(cb.equal(root.get("status"), Audio.Status.PUBLISHED));
            predicates.add(cb.isNull(root.get("deletedAt")));

            // filter by speaker name
            if (speakerName != null && !speakerName.isBlank()) {
                Join<Audio, AudioSpeakerJoin> speakerJoin =
                        root.join("audioSpeakers", JoinType.LEFT);

                Join<AudioSpeakerJoin, Speaker> speaker =
                        speakerJoin.join("speaker", JoinType.LEFT);

                predicates.add(cb.like(
                        cb.lower(speaker.get("name")),
                        "%" + speakerName.toLowerCase() + "%"
                ));
            }

            // filter by tags
            if (tag != null && !tag.isBlank()) {
                Join<Audio, AudioTagJoin> tagJoin =
                        root.join("audioTags", JoinType.LEFT);

                Join<AudioTagJoin, Tag> tagEntity =
                        tagJoin.join("tag", JoinType.LEFT);

                predicates.add(cb.equal(
                        cb.lower(tagEntity.get("name")),
                        tag.toLowerCase()
                ));
            }

            // filter by genre
            if (genre != null && !genre.isBlank()) {
                Join<Audio, AudioGenreJoin> genreJoin =
                        root.join("audioGenres", JoinType.LEFT);

                Join<AudioGenreJoin, Genre> genreEntity =
                        genreJoin.join("genre", JoinType.LEFT);

                predicates.add(cb.equal(
                        cb.lower(genreEntity.get("name")),
                        genre.toLowerCase()
                ));
            }

            // Title + description search
            if (audioSubstring != null && !audioSubstring.isBlank()) {
                String keyword = "%" + audioSubstring.toLowerCase() + "%";

                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), keyword),
                        cb.like(cb.lower(root.get("description")), keyword)
                ));
            }

            query.distinct(true);
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return audioRepository.findAll(spec)
                .stream()
                .map(AudioResponse::fromEntity)
                .toList();
    }

    /**
     * Get audio by ID
     */
    @Transactional(readOnly = true)
    public AudioResponse getAudioById(UUID id) {
        Audio audio = audioRepository.findByIdWithSpeakers(id)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + id));
        return AudioResponse.fromEntity(audio);
    }

    /**
     * Get all draft (staging) audio
     */
    @Transactional
    public List<AudioResponse> getStagingAudio() {
        return getAllAudio(Audio.Status.DRAFT);
    }

    /**
     * Get all published audio
     */
    @Transactional(readOnly = true)
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
        if (request.getSpeakerId() != null) {
            Speaker speaker = resolveSpeaker(audio.getTenantId(), request.getSpeakerId());
            replaceSpeakers(audio, List.of(speaker));
            audio.setSpeaker(speaker.getName());
        } else if (request.getSpeakerIds() != null) {
            List<Speaker> speakers = request.getSpeakerIds().stream()
                    .map(speakerId -> resolveSpeaker(audio.getTenantId(), speakerId))
                    .toList();
            replaceSpeakers(audio, speakers);
            audio.setSpeaker(speakers.stream().map(Speaker::getName).collect(Collectors.joining(", ")));
        }
        if (request.getTopic() != null) {
            audio.setTopic(request.getTopic());
        }
        if (request.getLanguage() != null) {
            audio.setLanguage(request.getLanguage());
        }
        if ((audio.getDurationSeconds() == null || audio.getDurationSeconds() <= 0)
                && request.getDurationSeconds() != null
                && request.getDurationSeconds() > 0) {
            audio.setDurationSeconds(request.getDurationSeconds());
        }
        // Series assignment
        if (request.getSeriesId() != null) {
            audio.setSeriesId(request.getSeriesId());
        }
        if (request.getSeriesOrder() != null) {
            audio.setSeriesOrder(request.getSeriesOrder());
        }

        Audio saved = audioRepository.save(audio);
        log.info("Updated audio: {}", saved.getId());

        return AudioResponse.fromEntity(saved);
    }

    private Speaker resolveSpeaker(UUID tenantId, UUID speakerId) {
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new RuntimeException("Speaker not found: " + speakerId));

        if (!tenantId.equals(speaker.getTenantId())) {
            throw new RuntimeException("Speaker not found: " + speakerId);
        }

        return speaker;
    }

    private void attachSpeaker(Audio audio, Speaker speaker) {
        AudioSpeakerJoin join = new AudioSpeakerJoin();
        join.setId(new AudioSpeakerJoinId(audio.getId(), speaker.getId()));
        join.setAudio(audio);
        join.setSpeaker(speaker);
        join.setRole(AudioSpeakerJoin.Role.SPEAKER);
        join.setDisplayOrder(0);
        audio.getAudioSpeakers().add(join);
    }

    private void replaceSpeakers(Audio audio, List<Speaker> speakers) {
        if (audio.getId() == null) {
            throw new IllegalStateException("Audio must be saved before speakers can be linked");
        }

        audioSpeakerJoinRepository.deleteAllByAudioId(audio.getId());
        audio.getAudioSpeakers().clear();

        for (int i = 0; i < speakers.size(); i++) {
            Speaker speaker = speakers.get(i);
            AudioSpeakerJoin join = new AudioSpeakerJoin();
            join.setId(new AudioSpeakerJoinId(audio.getId(), speaker.getId()));
            join.setAudio(audio);
            join.setSpeaker(speaker);
            join.setRole(AudioSpeakerJoin.Role.SPEAKER);
            join.setDisplayOrder(i);
            AudioSpeakerJoin savedJoin = audioSpeakerJoinRepository.save(join);
            audio.getAudioSpeakers().add(savedJoin);
        }
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

    /**
     *  Compute SHA-256 hash from a byte array (for MultipartFile uploads).
     * Called from AudioController: AudioService.computeFileHash(file.getBytes())
     */
    public static String computeFileHash(byte[] fileBytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(fileBytes);
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * Compute SHA-256 hash from a file path (for bulk import).
     * Streams in 8KB chunks — does NOT load entire file into memory.
     * Called from BulkImportService: AudioService.computeFileHash(sourceFile)
     */
    public static String computeFileHash(Path filePath) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream is = Files.newInputStream(filePath);
                 DigestInputStream dis = new DigestInputStream(is, digest)) {
                byte[] buffer = new byte[8192];
                while (dis.read(buffer) != -1) {
                    // reading through to compute hash
                }
            }
            byte[] hashBytes = digest.digest();
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * ADDED: Exception thrown when a duplicate file is detected during upload.
     * Caught by AudioController to return HTTP 409 Conflict with details.
     */
    public static class DuplicateFileException extends RuntimeException {
        private final UUID existingAudioId;
        private final String existingTitle;

        public DuplicateFileException(String message, UUID existingAudioId, String existingTitle) {
            super(message);
            this.existingAudioId = existingAudioId;
            this.existingTitle = existingTitle;
        }

        public UUID getExistingAudioId() { return existingAudioId; }
        public String getExistingTitle() { return existingTitle; }
    }


    /**
     *  Bulk publish audio files (DRAFT → PUBLISHED).
     * Processes each ID independently — one failure does not block others.
     */
    @Transactional
    public BulkActionResult bulkPublish(List<UUID> audioIds) {
        log.info("Bulk publish requested for {} audio files", audioIds.size());
        return executeBulkAction(audioIds, "publish", audio -> {
            if (audio.getStatus() == Audio.Status.PUBLISHED) {
                return "Already published";
            }
            if (audio.isDeleted()) {
                return "Audio is deleted";
            }
            audio.setStatus(Audio.Status.PUBLISHED);
            audio.setPublishedAt(LocalDateTime.now());
            audioRepository.save(audio);
            return null;
        });
    }

    /**
     * ADDED: Bulk unpublish audio files (PUBLISHED → DRAFT).
     */
    @Transactional
    public BulkActionResult bulkUnpublish(List<UUID> audioIds) {
        log.info("Bulk unpublish requested for {} audio files", audioIds.size());
        return executeBulkAction(audioIds, "unpublish", audio -> {
            if (audio.getStatus() == Audio.Status.DRAFT) {
                return "Already in draft";
            }
            if (audio.isDeleted()) {
                return "Audio is deleted";
            }
            audio.setStatus(Audio.Status.DRAFT);
            audio.setPublishedAt(null);
            audioRepository.save(audio);
            return null;
        });
    }

    /**
     *Bulk archive audio files (any status → ARCHIVED).
     */
    @Transactional
    public BulkActionResult bulkArchive(List<UUID> audioIds) {
        log.info("Bulk archive requested for {} audio files", audioIds.size());
        return executeBulkAction(audioIds, "archive", audio -> {
            if (audio.getStatus() == Audio.Status.ARCHIVED) {
                return "Already archived";
            }
            if (audio.isDeleted()) {
                return "Audio is deleted";
            }
            audio.setStatus(Audio.Status.ARCHIVED);
            audioRepository.save(audio);
            return null;
        });
    }

    /**
     *Generic bulk action executor. Processes each audio independently.
     */
    private BulkActionResult executeBulkAction(List<UUID> audioIds, String action,
                                               java.util.function.Function<Audio, String> processor) {
        List<BulkActionResult.ItemResult> results = new ArrayList<>();
        int successCount = 0;
        int failedCount = 0;
        int skippedCount = 0;

        for (UUID id : audioIds) {
            try {
                Optional<Audio> audioOpt = audioRepository.findById(id);
                if (audioOpt.isEmpty()) {
                    results.add(new BulkActionResult.ItemResult(id, "FAILED", "Audio not found"));
                    failedCount++;
                    continue;
                }
                String error = processor.apply(audioOpt.get());
                if (error == null) {
                    results.add(new BulkActionResult.ItemResult(id, "SUCCESS", null));
                    successCount++;
                } else {
                    results.add(new BulkActionResult.ItemResult(id, "SKIPPED", error));
                    skippedCount++;
                }
            } catch (Exception e) {
                log.error("Bulk {} failed for audio {}: {}", action, id, e.getMessage());
                results.add(new BulkActionResult.ItemResult(id, "FAILED", e.getMessage()));
                failedCount++;
            }
        }

        log.info("Bulk {} completed: {} success, {} skipped, {} failed out of {} total",
                action, successCount, skippedCount, failedCount, audioIds.size());

        return BulkActionResult.builder()
                .action(action)
                .totalRequested(audioIds.size())
                .successCount(successCount)
                .skippedCount(skippedCount)
                .failedCount(failedCount)
                .results(results)
                .build();
    }

    /**
     * Result DTO for bulk actions.
     */
    @lombok.Data
    @lombok.Builder
    public static class BulkActionResult {
        private String action;
        private int totalRequested;
        private int successCount;
        private int skippedCount;
        private int failedCount;
        private List<ItemResult> results;

        @lombok.Data
        @lombok.AllArgsConstructor
        public static class ItemResult {
            private UUID audioId;
            private String status;
            private String reason;
        }
    }
}
